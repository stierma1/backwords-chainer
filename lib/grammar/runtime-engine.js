var {Parser} = require("./grammar");
var GoalParser = require("./goal").Parser;
var createContext = require("./context");
var {SubstitutionSet} = require("./../unification").Unification;
var {Predicate} = require("./../unification")
var tsr = require("./../unification/trs");

class RuntimeEngine{
  constructor(systemCalls){
    this.parser = new Parser();
    this.context = createContext(systemCalls);
    this.parser.yy = this.context;
  }

  parseRules(rulesString){
    var newClauses = this.parser.parse(rulesString);
    for(var i in newClauses){
      this.context.hornClauses.push(newClauses[i]);
    }
    return this;
  }

  addRule(rule){

    this.context.hornClauses.push(rule);
    return this;
  }

  run(goal){
    var goalToUnify = goal;
    if(typeof(goal) === "string"){
      var goalParser = new GoalParser();
      goalParser.yy = this.context;
      goalToUnify = goalParser.parse(goal);
    }
    return this._cleanStatement(goalToUnify);
  }

  loadDefaults(){
    this.parseRules(`
      push(X, P, [X | P]).
      pop(X, [X | P], P).
      peek([X | P], X).

      select(X, [], []).
      select(X, [X | P], P).
      select(X, [Y | P], [Y | Z]) :- not(=(X,Y)), select(X, P, Z).

      delete(X, Y, Z) :- not(member(Y, X)), =(X, Z).
      delete(X, Y, Z) :- select(Y, X, P), delete(P, Y, Z).

      append(X, L, L) :- not(=(L, [])), append(X, [], L).
      append([], [], _).
      append([X | Y],[], [X | L]) :- append(Y, [], L).

      nextto(X, Y, [X, Y | _]).
      nextto(X, Y, [S | Q]) :- not(=(X,S)), nextto(X, Y, Q).
    `);
    return this;
  }

  toString(){
    var s = "";
    for(var i in this.context.hornClauses){
      s += this.context.hornClauses[i].toString() + "\n";
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
