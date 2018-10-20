var {Parser} = require("./grammar");
var GoalParser = require("./goal").Parser;
var createContext = require("./context");
var {SubstitutionSet} = require("./../unification").Unification;
var {Predicate, Atom, StringAtom, NumberAtom, List, Variable} = require("./../unification")
var tsr = require("./../unification/trs");

class RuntimeEngine{
  constructor(systemCalls){
    this.parser = new Parser();
    this.context = createContext((argument, substitutionSet) => {
      var res = this.builtInSystemCalls(argument, substitutionSet);
      if(res){
        return res;
      }
      return systemCalls(argument, substitutionSet)
    });
    this.parser.yy = this.context;
  }

  parseRules(rulesString){
    var newClauses = this.parser.parse(rulesString);
    for(var i in newClauses){
      this.addRule(newClauses[i]);
    }
    return newClauses;
  }

  addRule(rule){
    var {name, argsList} = rule.head;
    this.context.hornClauses[name] = this.context.hornClauses[name] || {};
    this.context.hornClauses[name][argsList.length] = this.context.hornClauses[name][argsList.length] || [];
    this.context.hornClauses[name][argsList.length].push(rule);
    return this;
  }

  setCurrentObjectBindings(objectMap){
    this.context.setCurrentObjectBindings(objectMap);
    return this;
  }

  retractRule(rule){
    for(var i = 0; i < this.context.hornClauses.length; i++){
      if(this.context.hornClauses[i] === rule){
        Array.splice(this.context.hornClauses, i,1);
      }
    }
    return this;
  }


  run(goal){
    var goalToUnify = goal;
    if(typeof(goal) === "string"){
      var goalParser = new GoalParser();
      goalParser.yy = this.context;
      try{
      goalToUnify = goalParser.parse(goal);
    }catch(e){
      console.log(e)
    }
    }
    return this._cleanStatement(goalToUnify);
  }

  builtInSystemCalls(argument, substitutionSet){
    if(argument === null || !(argument instanceof Predicate)){
      return null;
    }

    switch(argument.name){
      case "isAtom" : return argument.argsList[0] instanceof Atom ? substitutionSet : null;
      case "isNumber": return argument.argsList[0] instanceof NumberAtom ? substitutionSet : null;
      case "isString": return argument.argsList[0] instanceof StringAtom ? substitutionSet : null;
      case "isList": return (argument.argsList[0] instanceof List || (argument.argsList[0] instanceof Atom && argument.argsList[0].name === "[]"))  ? substitutionSet : null;
      case "isPredicate": return argument.argsList[0] instanceof Predicate ? substitutionSet : null;
      case "isVariable": return argument.argsList[0] instanceof Variable ? substitutionSet : null;
      default: return null;
    }
  }

  loadDefaults(){
    this.parseRules(`
      push(X, P, [X | P]).
      pop(X, [X | P], P).
      peek([X | P], X).

      select(X, [], []).
      select(X, [X | P], P).
      select(X, [Y | P], [Y | Z]) :- not(=(X,Y)), select(X, P, Z).

      member2(X, [], fail).
      member2(X, [X | Y], true).
      member2(X, [_ | Y], V) :- member2(X, Y, V).

      subset2([], _).
      subset2([X | L], Y) :- once(member(X, Y)), once(subset2(L, Y)).

      equivalent(X, Y) :- subset2(X, Y), subset2(Y, X).

      permutation([], []).
      permutation(X, [Z | Y]) :- select(Z, X, P), permutation(P, Y).

      delete(X, Y, X) :- not(member(Y, X)).
      delete(X, Y, Z) :- select(Y, X, P), delete(P, Y, Z).

      append([], [], []).
      append(X, L, L) :- not(=(L, [])), append(X, [], L).
      append([X | Y],[], [X | L]) :- append(Y, [], L).

      nextto(X, Y, [X, Y | _]).
      nextto(X, Y, [S | Q]) :- not(=(X,S)), nextto(X, Y, Q).

      keyValue(Key, Value).
      keyValueList([Key, Value]) :- keyValue(Key, Value).

      count([], 0).
      count([X | Y], Z) :- count(Y, B), +(1, B, Z).

      forEach([]).
      forEach([X | Y]) :- call(X), forEach(Y).

      max(X, Y, X) :- >(X, Y).
      max(X, Y, Y) :- not(>(X, Y)).
      min(X, Y, X) :- <(X, Y).
      min(X, Y, Y) :- not(<(X, Y)).

      max([X], X).
      max([X | Y], Z) :- max(Y, Q), max(X, Q, Z).

      min([X], X).
      min([X | Y], Z) :- min(Y, Q), min(X, Q, Z).

      inRange(Num, Low, High) :- >(Num, Low), <(Num, High).
      inRangeInclusive(Num, Low, High) :- >=(Num, Low), <=(Num, High).

      planner(CurrentState, DesiredState, [], CurrentState, _) :- subset2(DesiredState, CurrentState).
      planner(CurrentState, DesiredState, [Action | ActionList], Z, Depth) :- not(=(Depth, 0)), +(1, NewDepth, Depth),
        possible(Action, CurrentState, UpdatedState), planner(UpdatedState, DesiredState, ActionList, Z, NewDepth).

      possible(Action, CurrentState, UpdatedState) :- holds(Action, CurrentState, UpdatedState).

      agent(CurrentState, DesiredState, ResultState, MaxDepth) :- once(planner(CurrentState, DesiredState, ActionList, ResultState, MaxDepth)), doAll(ActionList).

      doAll([]).
      doAll([Action | MoreActions]) :- once(systemCall(Action)), doAll(MoreActions).

    `);
    return this;
  }

  getPredicatesByName(predicateName){
    var predicate = this.context.hornClauses[predicateName];
    if(!predicate){
      return [];
    }
    var results = [];
    for(var arity in predicate){
      var arityNum = parseInt(arity);
      var variables = [];
      for(var i = 0; i < arityNum; i++){
        variables.push("G" + i);
      }
      var gen = this.run(predicateName + "(" + variables.join(",") + ")");
      do{
        var {value, done} = gen.next();
        if(done){
          continue;
        }
        var v =variables.map((varName) => {
          return value[varName].toString();
        });

        results.push(predicateName + "(" + v.join(", ") + ").");
      } while(!done)
    }
    return results;
  }

  toString(){
    var s = "";
    var suffix = / :- =\(true, true\)\.$/
    for(var i in this.context.hornClauses){
      if(i !== "member" && i !== "subset"){
        var clauseGroup = this.context.hornClauses[i];
        for(var j in clauseGroup){
          var arities = clauseGroup[j];
          arities.map((ar) => {
            s += ar.toString().replace(suffix, ".") + "\n";
          });
        }
      }
    }
    return s;
  }

  * _cleanStatement(goal){
    var gen = goal.unify(new SubstitutionSet({}))
    var {value, done} = gen.next();
    while(!done){

      if(value){
        //console.log(value.toString())
        tsr(value);
        //console.log(value.toString())
        var cleaned = {};

        for(var val in value.collection){
          if(val[0] !== "_"){
            if(value.collection[val] instanceof Predicate){
              var filled = value.collection[val].deepCopyWithReplace(value)
              cleaned[val] = filled;
            } else {
              cleaned[val] = value.collection[val];
            }
          }
        }

        yield cleaned;
      } else {
        yield value;
      }
      var {value, done} = gen.next();
    }
  }
}

module.exports = RuntimeEngine;
