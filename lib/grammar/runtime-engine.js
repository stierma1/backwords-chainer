var {Parser} = require("./grammar");
var GoalParser = require("./goal").Parser;
var createContext = require("./context");
var {SubstitutionSet, unify, andUnify} = require("./../unification").Unification;
var {Predicate, Atom, StringAtom, NumberAtom, List, Variable} = require("./../unification")
var {AndStatements, OrStatements, PredicateStatement, CallStatement, ApplyStatement, AllSolutionsStatement, ForallStatement, createBuiltInPredicateStatement} = require("./../unification/statements");
var tsr = require("./../unification/trs");

class RuntimeEngine{
  constructor(systemCalls){
    this.systemCalls = typeof(systemCalls) === "function" ? systemCalls : null;
    this.parser = new Parser();
    this.context = createContext((argument, substitutionSet) => {
      var res = this.builtInSystemCalls(argument, substitutionSet);
      if(res){
        return res;
      }
      if(!this.systemCalls){
        return null;
      }
      return this.systemCalls(argument, substitutionSet);
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
    if(!rule || !rule.head){
      return this;
    }
    var name = rule.head.name;
    var arity = rule.head.argsList.length;
    var clauseGroup = this.context.hornClauses[name];
    if(!clauseGroup || !clauseGroup[arity]){
      return this;
    }
    var clauses = clauseGroup[arity];
    for(var i = 0; i < clauses.length; i++){
      if(clauses[i] === rule || (rule.raw && clauses[i].raw === rule.raw)){
        clauses.splice(i, 1);
        break;
      }
    }
    if(clauses.length === 0){
      delete clauseGroup[arity];
    }
    return this;
  }


  run(goal, options){
    var goalToUnify = this._parseGoal(goal);
    if(this._searchStrategy(options) === "breadth-first"){
      return this._cleanResults(this._searchBreadthFirst(goalToUnify, options));
    }
    return this._cleanStatement(goalToUnify);
  }

  solve(goal, options){
    return this.run(goal, options);
  }

  runDepthFirst(goal, options){
    var searchOptions = {};
    if(options && typeof(options) === "object"){
      for(var key in options){
        searchOptions[key] = options[key];
      }
    }
    searchOptions.search = "depth-first";
    return this.run(goal, searchOptions);
  }

  runBreadthFirst(goal, options){
    var searchOptions = {};
    if(options && typeof(options) === "object"){
      for(var key in options){
        searchOptions[key] = options[key];
      }
    }
    searchOptions.search = "breadth-first";
    return this.run(goal, searchOptions);
  }

  _parseGoal(goal){
    if(typeof(goal) !== "string"){
      return goal;
    }

    var goalParser = new GoalParser();
    goalParser.yy = this.context;
    try{
      return goalParser.parse(goal);
    }catch(e){
      throw new Error("Unable to parse goal: " + goal);
    }
  }

  _searchStrategy(options){
    var strategy = options;
    if(options && typeof(options) === "object"){
      strategy = options.search || options.strategy;
    }
    if(!strategy){
      return "depth-first";
    }

    strategy = String(strategy).toLowerCase();
    if(strategy === "bfs" || strategy === "breadth" || strategy === "breadth-first" || strategy === "breadth_first"){
      return "breadth-first";
    }
    return "depth-first";
  }

  _normalizeGoals(goals){
    var normalized = [];
    var pending = goals.slice();

    while(pending.length > 0){
      var goal = pending.shift();
      if(goal instanceof AndStatements){
        pending = goal.subStatements.concat(pending);
      } else {
        normalized.push(goal);
      }
    }

    return normalized;
  }

  _expandPredicate(predicate, hornClauses, substitutionSet){
    var builtIn = createBuiltInPredicateStatement(predicate, hornClauses, this._breadthFirstGoalSolver());
    if(builtIn){
      return this._expandStatement(builtIn, substitutionSet);
    }

    var clausesByName = hornClauses && hornClauses[predicate.name];
    if(!clausesByName){
      return [];
    }

    var clauses = clausesByName[predicate.argsList.length];
    if(!clauses || clauses.length === 0){
      return [];
    }

    var currentPredicate = predicate.deepCopyWithReplace(substitutionSet);
    var successors = [];

    for(var i = 0; i < clauses.length; i++){
      var instance = clauses[i].getRuntimeInstance();
      var merged = andUnify([substitutionSet, unify(currentPredicate, instance.head)]);
      if(!merged){
        continue;
      }

      var bodyGoals = [];
      if(instance.body instanceof AndStatements){
        bodyGoals = instance.body.subStatements.slice();
      } else if(instance.body){
        bodyGoals = [instance.body];
      }

      successors.push({goals:bodyGoals, substitutionSet:merged});
    }

    return successors;
  }

  _expandStatement(statement, substitutionSet){
    if(!statement || typeof(statement.unify) !== "function"){
      return [];
    }

    var replaceGoalSolver = statement instanceof AllSolutionsStatement || statement instanceof ForallStatement;
    var previousGoalSolver = statement.goalSolver;
    if(replaceGoalSolver){
      statement.goalSolver = this._breadthFirstGoalSolver();
    }

    var successors = [];
    try{
      var results = statement.unify(substitutionSet);
      for(var value of results){
        if(value === null || value === undefined){
          continue;
        }
        var merged = value === substitutionSet ? value : andUnify([substitutionSet, value]);
        if(merged){
          successors.push({goals:[], substitutionSet:merged});
        }
      }
    } finally {
      if(replaceGoalSolver){
        statement.goalSolver = previousGoalSolver;
      }
    }

    return successors;
  }

  _breadthFirstGoalSolver(){
    var self = this;

    return function(goal, substitutionSet, hornClauses){
      var statement = null;
      if(goal instanceof Predicate){
        statement = new PredicateStatement({predicate:goal, hornClauses:hornClauses});
      } else if(goal && typeof(goal.unify) === "function"){
        statement = goal;
      }

      if(!statement){
        return null;
      }

      return self._searchBreadthFirstFrom(statement, substitutionSet, {});
    };
  }

  _expandGoal(goal, substitutionSet){
    if(goal instanceof AndStatements){
      return [{goals:goal.subStatements.slice(), substitutionSet:substitutionSet}];
    }

    if(goal instanceof OrStatements){
      return goal.subStatements.map((statement) => {
        return {goals:[statement], substitutionSet:substitutionSet};
      });
    }

    if(goal instanceof PredicateStatement){
      return this._expandPredicate(goal.predicate, goal.hornClauses, substitutionSet);
    }

    if(goal instanceof CallStatement){
      var calledPredicate = goal.getCalledPredicate(substitutionSet);
      return calledPredicate ? this._expandPredicate(calledPredicate, goal.hornClauses, substitutionSet) : [];
    }

    if(goal instanceof ApplyStatement){
      var appliedPredicate = goal.getAppliedPredicate(substitutionSet);
      return appliedPredicate ? this._expandPredicate(appliedPredicate, goal.hornClauses, substitutionSet) : [];
    }

    return this._expandStatement(goal, substitutionSet);
  }

  * _searchBreadthFirst(goal, options){
    yield* this._searchBreadthFirstFrom(goal, new SubstitutionSet({}), options);
  }

  * _searchBreadthFirstFrom(goal, initialSubstitutionSet, options){
    options = options && typeof(options) === "object" ? options : {};
    var maxDepth = options.maxDepth === undefined ? Infinity : options.maxDepth;
    var maxNodes = options.maxNodes === undefined ? Infinity : options.maxNodes;
    var queue = [{goals:[goal], substitutionSet:initialSubstitutionSet || new SubstitutionSet({}), depth:0}];
    var queueIndex = 0;
    var expandedNodes = 0;

    while(queueIndex < queue.length){
      var state = queue[queueIndex++];
      if(state.depth > maxDepth){
        continue;
      }

      var goals = this._normalizeGoals(state.goals);
      if(goals.length === 0){
        yield state.substitutionSet;
        continue;
      }

      if(expandedNodes >= maxNodes){
        return;
      }
      expandedNodes++;

      var remainingGoals = goals.slice(1);
      var successors = this._expandGoal(goals[0], state.substitutionSet);
      for(var i = 0; i < successors.length; i++){
        var successor = successors[i];
        queue.push({
          goals:successor.goals.concat(remainingGoals),
          substitutionSet:successor.substitutionSet,
          depth:state.depth + 1
        });
      }
    }
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

      select(X, [X | P], P).
      select(X, [Y | P], [Y | Z]) :- not(=(X,Y)), select(X, P, Z).

      member2(X, [], fail).
      member2(X, [X | Y], true).
      member2(X, [_ | Y], V) :- member2(X, Y, V).

      subset2([], _).
      subset2([X | L], Y) :- once(member(X, Y)), once(subset2(L, Y)).

      equivalent(X, Y) :- subset2(X, Y), subset2(Y, X).

      insert(X, Ys, [X | Ys]).
      insert(X, [Y | Ys], [Y | Zs]) :- insert(X, Ys, Zs).

      permutation([], []).
      permutation([X | Xs], Ys) :- permutation(Xs, Zs), insert(X, Zs, Ys).

      delete([], _, []).
      delete([X | Xs], X, Ys) :- delete(Xs, X, Ys).
      delete([Z | Xs], X, [Z | Ys]) :- not(=(X, Z)), delete(Xs, X, Ys).

      append([], L, L).
      append([X | Y], L, [X | Z]) :- append(Y, L, Z).

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

  _cleanSubstitution(value){
    tsr(value);
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

    return cleaned;
  }

  * _cleanResults(results){
    for(var value of results){
      if(value){
        yield this._cleanSubstitution(value);
      } else {
        yield value;
      }
    }
  }

  * _cleanStatement(goal){
    yield* this._cleanResults(goal.unify(new SubstitutionSet({})));
  }
}

module.exports = RuntimeEngine;
