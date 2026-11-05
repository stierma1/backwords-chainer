
var {unify, andUnify, SubstitutionSet} = require("./unification");
var {generateRuntimeVariable} = require("./utils");
var Variable = require("./variable");
var Predicate = require("./predicate");
var Atom = require("./atom");
var NumberAtom = require("./number");
var List = require("./list");
var trs = require("./trs");

var runtimeVariableIdx = 0;
class AndStatements{
  constructor({subStatements, raw}){
    this.subStatements = subStatements || [];
    this.raw = raw;
  }

  * unify(substitutionSet){
    var [headStatement, ...tailStatements] = this.subStatements;
    if(this.subStatements.length === 0) {
      yield substitutionSet;
    } else if(tailStatements.length === 0){
      yield* headStatement.unify(substitutionSet);
      return;
    } else {
      var headStatementGen = headStatement.unify(substitutionSet);
      var andState = new AndStatements({subStatements:tailStatements});

      var {value, done} = headStatementGen.next();

      while(!done){
        if(value !== null && value !== undefined){
          var tailsStatementsGen = andState.unify(andUnify([substitutionSet,value]));
          var tailObj = tailsStatementsGen.next();
          var value1 = tailObj.value;
          var done1 = tailObj.done;

          while(!done1){
            if(value1 !== null && value1 !== undefined){
              var retValue = andUnify([value, value1]);
              if(retValue !== null){
                yield retValue;
              }
            }
            tailObj = tailsStatementsGen.next();
            value1 = tailObj.value;
            done1 = tailObj.done;
          }
        }
        var {value, done} = headStatementGen.next();
      }
    }

  }

  getRuntimeSubstitution(substitutionSet){
    for(var i = 0; i < this.subStatements.length; i++){
      this.subStatements[i].getRuntimeSubstitution(substitutionSet);
    }
  }

  getRuntimeInstance(substitutionSet){
    var newSubStatements = [];
    for(var i = 0; i < this.subStatements.length; i++){
      newSubStatements.push(this.subStatements[i].getRuntimeInstance(substitutionSet));
    }
    return new AndStatements({subStatements:newSubStatements});
  }

  toString(){
    return this.subStatements.map((s) => { return s.toString()}).join(", ");
  }
}

class OrStatements{
  constructor({subStatements, raw}){
    this.subStatements = subStatements || [];
    this.raw = raw;
  }

  * unify(substitutionSet){
    for(var i = 0; i < this.subStatements.length; i++){
      var unionGen = this.subStatements[i].unify(substitutionSet);
      var {value, done} = unionGen.next();
      while(!done){
        if(value !== null && value !== undefined){
          yield value;
        }
        var {value, done} = unionGen.next();
      }
    }
  }

  getRuntimeSubstitution(substitutionSet){
    for(var i = 0; i < this.subStatements.length; i++){
      this.subStatements[i].getRuntimeSubstitution(substitutionSet);
    }
  }

  getRuntimeInstance(substitutionSet){
    var newSubStatements = [];
    for(var i = 0; i < this.subStatements.length; i++){
      newSubStatements.push(this.subStatements[i].getRuntimeInstance(substitutionSet));
    }
    return new OrStatements({subStatements:newSubStatements});
  }

  toString(){
    return this.subStatements.map((s) => { return s.toString()}).join("; ");
  }
}

class UnionStatement{
  constructor({subject, object, raw}){
    this.subject = subject;
    this.object = object;
    this.raw = raw;
  }

  * unify(substitutionSet){
    var subject = this.subject;
    //substitutionSet.removeFreeVariables();
    if(this.subject instanceof Variable && substitutionSet.get(this.subject)){
      subject = substitutionSet.get(this.subject);
    } else if(this.subject instanceof Predicate){
      subject = this.subject.deepCopyWithReplace(substitutionSet)
    }

    var object = this.object;
    if(this.object instanceof Variable && substitutionSet.get(this.object)){
      object = substitutionSet.get(this.object);
    } else if(this.object instanceof Predicate){
      object = this.object.deepCopyWithReplace(substitutionSet)
    }

    var output = unify(subject, object);
    //console.log(subject.toString() + " = " + object.toString() + (output === null ? " -> null" : " -> " + output.toString()) );
    yield output
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.subject instanceof Variable){
      if(!substitutionSet.get(this.subject)){
        substitutionSet.add(this.subject, generateRuntimeVariable());
      }
    } else if(this.subject instanceof Predicate){
      this.subject.getRuntimeSubstitution(substitutionSet);
    }

    if(this.object instanceof Variable){
      if(!substitutionSet.get(this.object)){
        substitutionSet.add(this.object, generateRuntimeVariable());
      }
    } else if(this.object instanceof Predicate){
      this.object.getRuntimeSubstitution(substitutionSet);
    }
  }

  getRuntimeInstance(substitutionSet){
    var newUnion = {subject:null, object:null};

    if(this.subject instanceof Variable){
      newUnion.subject = substitutionSet.get(this.subject);
    } else if(this.subject instanceof Predicate){
      newUnion.subject = this.subject.getRuntimeInstance(substitutionSet);
    } else {
      newUnion.subject = this.subject;
    }

    if(this.object instanceof Variable){
      newUnion.object = substitutionSet.get(this.object);
    } else if(this.object instanceof Predicate){
      newUnion.object = this.object.getRuntimeInstance(substitutionSet);
    } else {
      newUnion.object = this.object;
    }

    return new UnionStatement(newUnion);
  }

  toString(){
    return "=(" + this.subject.toString() + ", " + this.object.toString() + ")";
  }
}

class NotStatement {
  constructor({subStatement, raw}){
    this.subStatement = subStatement;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    this.subStatement.getRuntimeSubstitution(substitutionSet);
  }

  getRuntimeInstance(substitutionSet){
    return new NotStatement({subStatement:this.subStatement.getRuntimeInstance(substitutionSet)})
  }

  * unify(substitutionSet){
    var succeeded = false;
    var subGen = this.subStatement.unify(substitutionSet);
    var {value,done} = subGen.next();
    while(!done){
      if(value !== null && value !== undefined){
        succeeded = true;
        break;
      }
      var next = subGen.next();
      value = next.value;
      done = next.done;
    }

    if(!succeeded){
      yield substitutionSet;
    }
  }
  toString(){
    return "not(" + this.subStatement.toString() + ") ";
  }
}

class OnceStatement {
  constructor({statement, raw}){
    this.statement = statement;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    this.statement.getRuntimeSubstitution(substitutionSet);
  }

  getRuntimeInstance(substitutionSet){
    return new OnceStatement({statement:this.statement.getRuntimeInstance(substitutionSet)})
  }

  * unify(substitutionSet){
    var subGen = this.statement.unify(substitutionSet);
    var {value,done} = subGen.next();
    if(value){
      yield value;
    }

  }
  toString(){
    return "once(" + this.statement.toString() + ") ";
  }
}

class CallStatement {
  constructor({statement, hornClauses, raw}){
    this.statement = statement;
    this.hornClauses = hornClauses;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.statement && typeof(this.statement.getRuntimeSubstitution) === "function"){
      this.statement.getRuntimeSubstitution(substitutionSet);
    } else if(this.statement instanceof Variable && !substitutionSet.get(this.statement)){
      substitutionSet.add(this.statement, generateRuntimeVariable());
    }
  }

  getRuntimeInstance(substitutionSet){
    var statement = this.statement;
    if(statement instanceof Variable){
      statement = substitutionSet.get(statement) || statement;
    } else if(statement && typeof(statement.getRuntimeInstance) === "function"){
      statement = statement.getRuntimeInstance(substitutionSet);
    }
    return new CallStatement({statement:statement, hornClauses:this.hornClauses, raw:this.raw});
  }

  * unify(substitutionSet){
    var statement = this.getCalledPredicate(substitutionSet);
    if(statement){
      var pred = new PredicateStatement({predicate:statement, hornClauses:this.hornClauses});
      yield* pred.unify(substitutionSet)
    }
  }

  getCalledPredicate(substitutionSet){
    var statement = this.statement;
    if(statement instanceof Variable){
      statement = substitutionSet.get(statement) || statement;
    }

    if(statement instanceof Atom && !(statement instanceof Predicate)){
      statement = new Predicate({name:statement.name, argsList:[]});
    }

    return statement instanceof Predicate ? statement : null;
  }
  toString(){
    return "call(" + this.statement.toString() + ") ";
  }
}

function resolveTerm(term, substitutionSet){
  var seen = {};
  while(term instanceof Variable && substitutionSet.get(term) && !seen[term.name]){
    seen[term.name] = true;
    term = substitutionSet.get(term);
  }
  return term;
}

function properListToArray(list){
  var items = [];
  var current = list;
  while(current instanceof Predicate){
    if(current.name !== "_list"){
      return null;
    }
    items.push(current.argsList[0]);
    current = current.argsList[1];
  }
  if(current instanceof Atom && current.name === "[]"){
    return items;
  }
  return null;
}

class ApplyStatement {
  constructor({predicate, args, hornClauses, raw}){
    this.predicate = predicate;
    this.args = args;
    this.hornClauses = hornClauses;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    [this.predicate, this.args].forEach((term) => {
      if(term instanceof Variable && !substitutionSet.get(term)){
        substitutionSet.add(term, generateRuntimeVariable());
      } else if(term && typeof(term.getRuntimeSubstitution) === "function"){
        term.getRuntimeSubstitution(substitutionSet);
      }
    });
  }

  getRuntimeInstance(substitutionSet){
    var resolve = (term) => {
      if(term instanceof Variable){
        return substitutionSet.get(term) || term;
      }
      if(term && typeof(term.getRuntimeInstance) === "function"){
        return term.getRuntimeInstance(substitutionSet);
      }
      return term;
    };
    return new ApplyStatement({predicate:resolve(this.predicate), args:resolve(this.args), hornClauses:this.hornClauses, raw:this.raw});
  }

  * unify(substitutionSet){
    var applied = this.getAppliedPredicate(substitutionSet);
    if(!applied){
      return;
    }

    yield* new PredicateStatement({predicate:applied, hornClauses:this.hornClauses}).unify(substitutionSet);
  }

  getAppliedPredicate(substitutionSet){
    var predicate = resolveTerm(this.predicate, substitutionSet);
    var args = resolveTerm(this.args, substitutionSet);
    var argsList = properListToArray(args);

    if(!argsList){
      return null;
    }

    var name = null;
    if(predicate instanceof Predicate){
      name = predicate.name;
    } else if(predicate instanceof Atom){
      name = predicate.name;
    }

    if(!name){
      return null;
    }

    return new Predicate({name:name, argsList:argsList});
  }

  toString(){
    return "apply(" + this.predicate.toString() + ", " + this.args.toString() + ")";
  }
}

class FunctorStatement {
  constructor({term, name, arity, raw}){
    this.term = term;
    this.name = name;
    this.arity = arity;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    [this.term, this.name, this.arity].forEach((term) => {
      if(term instanceof Variable && !substitutionSet.get(term)){
        substitutionSet.add(term, generateRuntimeVariable());
      } else if(term && typeof(term.getRuntimeSubstitution) === "function"){
        term.getRuntimeSubstitution(substitutionSet);
      }
    });
  }

  getRuntimeInstance(substitutionSet){
    var resolve = (term) => {
      if(term instanceof Variable){
        return substitutionSet.get(term) || term;
      }
      if(term && typeof(term.getRuntimeInstance) === "function"){
        return term.getRuntimeInstance(substitutionSet);
      }
      return term;
    };
    return new FunctorStatement({term:resolve(this.term), name:resolve(this.name), arity:resolve(this.arity), raw:this.raw});
  }

  * unify(substitutionSet){
    var term = resolveTerm(this.term, substitutionSet);
    var name = resolveTerm(this.name, substitutionSet);
    var arity = resolveTerm(this.arity, substitutionSet);

    if(term instanceof Predicate){
      var result = andUnify([
        unify(name, new Atom({name:term.name})),
        unify(arity, new NumberAtom({name:term.argsList.length}))
      ]);
      if(result){
        yield result;
      }
      return;
    }

    if(term instanceof Atom){
      var atomResult = andUnify([
        unify(name, new Atom({name:term.name})),
        unify(arity, new NumberAtom({name:0}))
      ]);
      if(atomResult){
        yield atomResult;
      }
      return;
    }

    if(term instanceof Variable && name instanceof Atom && arity instanceof NumberAtom){
      var arityNumber = arity.toNumber();
      if(arityNumber < 0 || Math.floor(arityNumber) !== arityNumber){
        return;
      }
      var constructed = null;
      if(arityNumber === 0){
        constructed = new Atom({name:name.name});
      } else {
        var args = [];
        for(var i = 0; i < arityNumber; i++){
          args.push(generateRuntimeVariable());
        }
        constructed = new Predicate({name:name.name, argsList:args});
      }
      yield* new UnionStatement({subject:term, object:constructed}).unify(substitutionSet);
    }
  }

  toString(){
    return "functor(" + this.term.toString() + ", " + this.name.toString() + ", " + this.arity.toString() + ")";
  }
}

function collectVariableNames(term, names){
  names = names || {};

  if(term instanceof Variable){
    names[term.name] = true;
  } else if(term instanceof Predicate){
    for(var i = 0; i < term.argsList.length; i++){
      collectVariableNames(term.argsList[i], names);
    }
  } else if(term instanceof AndStatements || term instanceof OrStatements){
    for(var i = 0; i < term.subStatements.length; i++){
      collectVariableNames(term.subStatements[i], names);
    }
  } else if(term instanceof PredicateStatement){
    collectVariableNames(term.predicate, names);
  } else if(term instanceof NotStatement || term instanceof OnceStatement || term instanceof CallStatement){
    collectVariableNames(term.subStatement || term.statement, names);
  } else if(term instanceof ApplyStatement){
    collectVariableNames(term.predicate, names);
    collectVariableNames(term.args, names);
  } else if(term instanceof FunctorStatement){
    collectVariableNames(term.term, names);
    collectVariableNames(term.name, names);
    collectVariableNames(term.arity, names);
  } else if(term instanceof SystemCallStatement){
    collectVariableNames(term.callObject, names);
  } else if(term instanceof UnionStatement){
    collectVariableNames(term.subject, names);
    collectVariableNames(term.object, names);
  } else if(term instanceof AddStatement || term instanceof MultiplyStatement){
    collectVariableNames(term.value1, names);
    collectVariableNames(term.value2, names);
    collectVariableNames(term.result, names);
  } else if(term instanceof GreaterThanStatement || term instanceof GreaterThanEqualStatement ||
            term instanceof LessThanStatement || term instanceof LessThanEqualStatement){
    collectVariableNames(term.value1, names);
    collectVariableNames(term.value2, names);
  }

  return names;
}

function instantiateTerm(term, substitutionSet, variableMap, seen){
  variableMap = variableMap || {};
  seen = seen || {};

  if(term instanceof Variable){
    if(seen[term.name]){
      if(!variableMap[term.name]){
        variableMap[term.name] = generateRuntimeVariable();
      }
      return variableMap[term.name];
    }

    var replacement = substitutionSet.get(term.name);
    if(replacement !== undefined){
      seen[term.name] = true;
      var resolved = instantiateTerm(replacement, substitutionSet, variableMap, seen);
      delete seen[term.name];
      return resolved;
    }

    if(!variableMap[term.name]){
      variableMap[term.name] = generateRuntimeVariable();
    }
    return variableMap[term.name];
  }

  if(term instanceof Predicate){
    var argsList = term.argsList.map(function(arg){
      return instantiateTerm(arg, substitutionSet, variableMap, seen);
    });
    return new term.constructor({name:term.name, argsList:argsList});
  }

  return term;
}

function termKey(term){
  if(term instanceof Variable){
    return "_";
  }
  if(term instanceof Predicate){
    return term.name + "(" + term.argsList.map(termKey).join(",") + ")";
  }
  return term.toString();
}

function compareTerms(first, second){
  if(first instanceof NumberAtom && second instanceof NumberAtom){
    return first.toNumber() - second.toNumber();
  }
  return termKey(first).localeCompare(termKey(second));
}

function sortUniqueTerms(terms){
  var sorted = terms.slice().sort(compareTerms);
  var result = [];
  var lastKey = null;

  for(var i = 0; i < sorted.length; i++){
    var key = termKey(sorted[i]);
    if(key !== lastKey){
      result.push(sorted[i]);
      lastKey = key;
    }
  }

  return result;
}

function* runGoal(goal, substitutionSet, hornClauses, goalSolver){
  if(goal instanceof Variable){
    goal = resolveTerm(goal, substitutionSet);
  }

  if(goal instanceof Atom && !(goal instanceof Predicate)){
    if(goal.name === "true"){
      yield substitutionSet;
      return;
    }
    if(goal.name === "fail" || goal.name === "false"){
      return;
    }
    goal = new Predicate({name:goal.name, argsList:[]});
  }

  if(goal instanceof Predicate){
    if(goal.name === "true" && goal.argsList.length === 0){
      yield substitutionSet;
      return;
    }
    if((goal.name === "fail" || goal.name === "false") && goal.argsList.length === 0){
      return;
    }
  }

  if(goalSolver){
    var solved = goalSolver(goal, substitutionSet, hornClauses);
    if(solved){
      yield* solved;
      return;
    }
  }

  if(goal instanceof Predicate){
    yield* new PredicateStatement({predicate:goal, hornClauses:hornClauses}).unify(substitutionSet);
    return;
  }

  if(goal && typeof(goal.unify) === "function"){
    yield* goal.unify(substitutionSet);
  }
}

function collectAllSolutions(template, goal, substitutionSet, hornClauses, goalSolver){
  var records = [];
  var results = runGoal(goal, substitutionSet, hornClauses, goalSolver);

  for(var result of results){
    if(result === null || result === undefined){
      continue;
    }

    var merged = result === substitutionSet ? result : andUnify([substitutionSet, result]);
    if(!merged){
      continue;
    }

    records.push({
      substitutionSet:merged,
      term:instantiateTerm(template, merged, {})
    });
  }

  return records;
}

function groupSolutions(records, freeVariableNames){
  var groups = [];
  var groupIndex = {};

  for(var i = 0; i < records.length; i++){
    var record = records[i];
    var bindings = {};
    var keyParts = [];

    for(var j = 0; j < freeVariableNames.length; j++){
      var name = freeVariableNames[j];
      var value = instantiateTerm(new Variable({name:name}), record.substitutionSet, {});
      bindings[name] = value;
      keyParts.push(termKey(value));
    }

    var key = keyParts.join("|");
    if(groupIndex[key] === undefined){
      groupIndex[key] = groups.length;
      groups.push({bindings:bindings, records:[]});
    }
    groups[groupIndex[key]].records.push(record);
  }

  return groups;
}

class AllSolutionsStatement {
  constructor({template, goal, bag, hornClauses, goalSolver, mode, raw}){
    this.template = template;
    this.goal = goal;
    this.bag = bag;
    this.hornClauses = hornClauses;
    this.goalSolver = goalSolver;
    this.mode = mode || "findall";
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    [this.template, this.goal, this.bag].forEach(function(term){
      if(term && typeof(term.getRuntimeSubstitution) === "function"){
        term.getRuntimeSubstitution(substitutionSet);
      }
    });
  }

  getRuntimeInstance(substitutionSet){
    var resolve = function(term){
      if(term instanceof Variable){
        return substitutionSet.get(term) || term;
      }
      if(term && typeof(term.getRuntimeInstance) === "function"){
        return term.getRuntimeInstance(substitutionSet);
      }
      return term;
    };

    return new AllSolutionsStatement({
      template:resolve(this.template),
      goal:resolve(this.goal),
      bag:resolve(this.bag),
      hornClauses:this.hornClauses,
      goalSolver:this.goalSolver,
      mode:this.mode,
      raw:this.raw
    });
  }

  * unify(substitutionSet){
    var records = collectAllSolutions(this.template, this.goal, substitutionSet, this.hornClauses, this.goalSolver);

    if(this.mode === "findall"){
      var items = records.map(function(record){
        return record.term;
      });
      var merged = andUnify([substitutionSet, unify(this.bag, List.fromArray(items))]);
      if(merged){
        yield merged;
      }
      return;
    }

    if(records.length === 0){
      return;
    }

    var templateVariables = collectVariableNames(this.template, {});
    var goalVariables = collectVariableNames(this.goal, {});
    var freeVariableNames = Object.keys(goalVariables).filter((name) => {
      return !templateVariables[name] && substitutionSet.get(name) === undefined;
    });
    var groups = groupSolutions(records, freeVariableNames);

    for(var i = 0; i < groups.length; i++){
      var group = groups[i];
      var groupItems = group.records.map(function(record){
        return record.term;
      });
      if(this.mode === "setof"){
        groupItems = sortUniqueTerms(groupItems);
      }

      var groupSubstitution = new SubstitutionSet({});
      for(var name in group.bindings){
        groupSubstitution.add(name, group.bindings[name]);
      }

      var merged = andUnify([
        substitutionSet,
        groupSubstitution,
        unify(this.bag, List.fromArray(groupItems))
      ]);
      if(merged){
        yield merged;
      }
    }
  }

  toString(){
    return this.mode + "(" + this.template.toString() + ", " + this.goal.toString() + ", " + this.bag.toString() + ")";
  }
}

class FindAllStatement extends AllSolutionsStatement {
  constructor(options){
    super(options);
    this.mode = "findall";
  }
}

class BagOfStatement extends AllSolutionsStatement {
  constructor(options){
    super(options);
    this.mode = "bagof";
  }
}

class SetOfStatement extends AllSolutionsStatement {
  constructor(options){
    super(options);
    this.mode = "setof";
  }
}

class ForallStatement {
  constructor({condition, action, hornClauses, goalSolver, raw}){
    this.condition = condition;
    this.action = action;
    this.hornClauses = hornClauses;
    this.goalSolver = goalSolver;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    [this.condition, this.action].forEach(function(term){
      if(term && typeof(term.getRuntimeSubstitution) === "function"){
        term.getRuntimeSubstitution(substitutionSet);
      }
    });
  }

  getRuntimeInstance(substitutionSet){
    var resolve = function(term){
      if(term instanceof Variable){
        return substitutionSet.get(term) || term;
      }
      if(term && typeof(term.getRuntimeInstance) === "function"){
        return term.getRuntimeInstance(substitutionSet);
      }
      return term;
    };

    return new ForallStatement({
      condition:resolve(this.condition),
      action:resolve(this.action),
      hornClauses:this.hornClauses,
      goalSolver:this.goalSolver,
      raw:this.raw
    });
  }

  * unify(substitutionSet){
    var conditionResults = runGoal(this.condition, substitutionSet, this.hornClauses, this.goalSolver);

    for(var conditionResult of conditionResults){
      if(conditionResult === null || conditionResult === undefined){
        continue;
      }

      var mergedCondition = conditionResult === substitutionSet ? conditionResult : andUnify([substitutionSet, conditionResult]);
      if(!mergedCondition){
        continue;
      }

      var actionSucceeded = false;
      var actionResults = runGoal(this.action, mergedCondition, this.hornClauses, this.goalSolver);
      for(var actionResult of actionResults){
        if(actionResult !== null && actionResult !== undefined){
          actionSucceeded = true;
          break;
        }
      }

      if(!actionSucceeded){
        return;
      }
    }

    yield substitutionSet;
  }

  toString(){
    return "forall(" + this.condition.toString() + ", " + this.action.toString() + ")";
  }
}

function createBuiltInPredicateStatement(predicate, hornClauses, goalSolver){
  var arity = predicate.argsList.length;

  if(predicate.name === "findall" && arity === 3){
    return new FindAllStatement({
      template:predicate.argsList[0],
      goal:predicate.argsList[1],
      bag:predicate.argsList[2],
      hornClauses:hornClauses,
      goalSolver:goalSolver
    });
  }

  if(predicate.name === "bagof" && arity === 3){
    return new BagOfStatement({
      template:predicate.argsList[0],
      goal:predicate.argsList[1],
      bag:predicate.argsList[2],
      hornClauses:hornClauses,
      goalSolver:goalSolver
    });
  }

  if(predicate.name === "setof" && arity === 3){
    return new SetOfStatement({
      template:predicate.argsList[0],
      goal:predicate.argsList[1],
      bag:predicate.argsList[2],
      hornClauses:hornClauses,
      goalSolver:goalSolver
    });
  }

  if(predicate.name === "forall" && arity === 2){
    return new ForallStatement({
      condition:predicate.argsList[0],
      action:predicate.argsList[1],
      hornClauses:hornClauses,
      goalSolver:goalSolver
    });
  }

  return null;
}

class PredicateStatement {
  constructor({predicate, hornClauses, raw}){
    this.predicate = predicate;
    this.hornClauses = hornClauses;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    this.predicate.getRuntimeSubstitution(substitutionSet);
  }

  getRuntimeInstance(substitutionSet){
    return new PredicateStatement({predicate:this.predicate.getRuntimeInstance(substitutionSet), hornClauses:this.hornClauses})
  }

  * unify(substitutionSet){
    if(!substitutionSet){
      return;
    }

    var builtIn = createBuiltInPredicateStatement(this.predicate, this.hornClauses);
    if(builtIn){
      yield* builtIn.unify(substitutionSet);
      return;
    }

    var clausesByName = this.hornClauses && this.hornClauses[this.predicate.name];
    if(!clausesByName){
      return;
    }

    var clauses = clausesByName[this.predicate.argsList.length];
    if(!clauses || clauses.length === 0){
      return;
    }

    var hornInstances = clauses
    .map((clause) => {
      return clause.getRuntimeInstance();
    });
    //trs(substitutionSet);
    var orStatements = hornInstances.map((hornInstance) => {
      //console.log(this.toString(), substitutionSet);
      var andStatements = [new UnionStatement({subject:this.predicate.deepCopyWithReplace(substitutionSet), object:hornInstance.head})];
      if(hornInstance.body){
        andStatements = andStatements.concat(hornInstance.body.subStatements);
      }

      return new AndStatements({subStatements:andStatements});
    })

    //console.log("Invoking predicate yielded: " + (new OrStatements({subStatements:orStatements})).toString(),"\n", substitutionSet.toString() + "\n\n")
    var gen = (new OrStatements({subStatements:orStatements})).unify(substitutionSet)
    var {value, done} = gen.next();
    while(!done){
      yield trs(value);
      var {value, done} = gen.next();
    }
  }

  toString(){
    return this.predicate.toString();
  }
}

class HornClause{
  constructor({head, body, raw}){
    this.head = head;
    this.body = body;
    this.raw = raw;
  }

  getRuntimeInstance(){
    var subSet = new SubstitutionSet({});
    this.head.getRuntimeSubstitution(subSet);
    this.body.getRuntimeSubstitution(subSet);

    var newHead = this.head.getRuntimeInstance(subSet);
    var newBody = this.body.getRuntimeInstance(subSet);
    return new HornClause({head:newHead, body:newBody, raw:this.raw});
  }

  toString(){
    return this.head.toString() + " :- " + this.body.toString() + "."
  }

  rawEquals(rawString){
    return this.raw === rawString;
  }
}

class SystemCallStatement{
  constructor(callObject, functionPointer, raw){
    this.callObject = callObject;
    this.functionPointer = functionPointer;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.callObject instanceof Variable){
      if(!substitutionSet.get(this.callObject)){
        substitutionSet.add(this.callObject, generateRuntimeVariable());
      }
    } else if(this.callObject instanceof Predicate){
      this.callObject.getRuntimeSubstitution(substitutionSet);
    }
  }

  getRuntimeInstance(substitutionSet){
    var newUnion = {callObject:null};

    if(this.callObject instanceof Variable){
      newUnion.callObject = substitutionSet.get(this.callObject);
    } else if(this.callObject instanceof Predicate){
      newUnion.callObject = this.callObject.getRuntimeInstance(substitutionSet);
    } else {
      newUnion.callObject = this.callObject;
    }

    return new SystemCallStatement(newUnion.callObject, this.functionPointer);
  }

  toString(){
    return "system(" + this.callObject.toString() + ")"
  }

  * unify(substitutionSet){

    if(typeof(this.functionPointer) !== "function"){
      return;
    }

    var val = (this.functionPointer(this.callObject, substitutionSet));
    if(val && typeof(val.next) === "function" && typeof(val[Symbol.iterator]) === "function"){
      yield* val;
    } else if(val !== null && val !== undefined){
      yield val;
    }

  }
}

class AddStatement{
  constructor({value1, value2, result, raw}){
    this.value1 = value1;
    this.value2 = value2;
    this.result = result;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.value1 instanceof Variable){
      if(!substitutionSet.get(this.value1)){
        substitutionSet.add(this.value1, generateRuntimeVariable());
      }
    }
    if(this.value2 instanceof Variable){
      if(!substitutionSet.get(this.value2)){
        substitutionSet.add(this.value2, generateRuntimeVariable());
      }
    }
    if(this.result instanceof Variable){
      if(!substitutionSet.get(this.result)){
        substitutionSet.add(this.result, generateRuntimeVariable());
      }
    } else if(this.result instanceof Predicate){
      this.result.getRuntimeSubstitution(substitutionSet);
    }
  }

  getRuntimeInstance(substitutionSet){
    var newUnion = {callObject:null};

    if(this.value1 instanceof Variable){
      newUnion.value1 = substitutionSet.get(this.value1);
    } else {
      newUnion.value1 = this.value1;
    }
    if(this.value2 instanceof Variable){
      newUnion.value2 = substitutionSet.get(this.value2);
    } else {
      newUnion.value2 = this.value2;
    }

    if(this.result instanceof Variable){

      newUnion.result = substitutionSet.get(this.result);
    } else if(this.result instanceof Predicate){
      newUnion.result = this.result.getRuntimeInstance(substitutionSet);
    } else {
      newUnion.result = this.result;
    }

    return new AddStatement(newUnion);
  }

  toString(){
    return "+(" + this.value1.toString() + ", " + this.value2.toString() + ", " + this.result.toString() + ")";
  }

  * unify(substitutionSet){
    //console.log(this, substitutionSet.toString())
    var value1 = this.value1;
    var value2 = this.value2;
    var result = this.result;

    if(value1 instanceof Variable){
      value1 = substitutionSet.get(value1) || value1;
    }
    if(value2 instanceof Variable){
      value2 = substitutionSet.get(value2) || value2;
    }
    if(result instanceof Variable){
      result = substitutionSet.get(result) || result;
    }

    if(value1 instanceof NumberAtom && value2 instanceof NumberAtom){
      yield* new UnionStatement({subject:result, object:new NumberAtom({name: value1.toNumber() + value2.toNumber()})}).unify(substitutionSet);
    } else if(value1 instanceof NumberAtom && result instanceof NumberAtom ) {
      yield* new UnionStatement({subject:value2, object:new NumberAtom({name: result.toNumber() - value1.toNumber()})}).unify(substitutionSet)
    } else if(value2 instanceof NumberAtom && result instanceof NumberAtom ) {
      yield* new UnionStatement({subject:value1, object:new NumberAtom({name: result.toNumber() - value2.toNumber()})}).unify(substitutionSet)
    }
  }
}

class MultiplyStatement{
  constructor({value1, value2, result, raw}){
    this.value1 = value1;
    this.value2 = value2;
    this.result = result;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.value1 instanceof Variable){
      if(!substitutionSet.get(this.value1)){
        substitutionSet.add(this.value1, generateRuntimeVariable());
      }
    }
    if(this.value2 instanceof Variable){
      if(!substitutionSet.get(this.value2)){
        substitutionSet.add(this.value2, generateRuntimeVariable());
      }
    }
    if(this.result instanceof Variable){
      if(!substitutionSet.get(this.result)){
        substitutionSet.add(this.result, generateRuntimeVariable());
      }
    } else if(this.result instanceof Predicate){
      this.result.getRuntimeSubstitution(substitutionSet);
    }
  }

  getRuntimeInstance(substitutionSet){
    var newUnion = {callObject:null};

    if(this.value1 instanceof Variable){
      newUnion.value1 = substitutionSet.get(this.value1);
    } else {
      newUnion.value1 = this.value1;
    }
    if(this.value2 instanceof Variable){
      newUnion.value2 = substitutionSet.get(this.value2);
    } else {
      newUnion.value2 = this.value2;
    }

    if(this.result instanceof Variable){

      newUnion.result = substitutionSet.get(this.result);
    } else if(this.result instanceof Predicate){
      newUnion.result = this.result.getRuntimeInstance(substitutionSet);
    } else {
      newUnion.result = this.result;
    }

    return new MultiplyStatement(newUnion);
  }

  toString(){
    return "*(" + this.value1.toString() + ", " + this.value2.toString() + ", " + this.result.toString() + ")";
  }

  * unify(substitutionSet){
    //console.log(this, substitutionSet.toString())
    var value1 = this.value1;
    var value2 = this.value2;
    var result = this.result;

    if(value1 instanceof Variable){
      value1 = substitutionSet.get(value1) || value1;
    }
    if(value2 instanceof Variable){
      value2 = substitutionSet.get(value2) || value2;
    }
    if(result instanceof Variable){
      result = substitutionSet.get(result) || result;
    }

    if(value1 instanceof NumberAtom && value2 instanceof NumberAtom){
      yield* new UnionStatement({subject:result, object:new NumberAtom({name: value1.toNumber() * value2.toNumber()})}).unify(substitutionSet);
    } else if(value1 instanceof NumberAtom && result instanceof NumberAtom ) {
      if(value1.toNumber() === 0){
        return;
      }
      yield* new UnionStatement({subject:value2, object:new NumberAtom({name: result.toNumber() / value1.toNumber()})}).unify(substitutionSet)
    } else if(value2 instanceof NumberAtom && result instanceof NumberAtom ) {
      if(value2.toNumber() === 0){
        return;
      }
      yield* new UnionStatement({subject:value1, object:new NumberAtom({name: result.toNumber() / value2.toNumber()})}).unify(substitutionSet)
    }
  }
}

class GreaterThanStatement{
  constructor({value1, value2, raw}){
    this.value1 = value1;
    this.value2 = value2;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.value1 instanceof Variable){
      if(!substitutionSet.get(this.value1)){
        substitutionSet.add(this.value1, generateRuntimeVariable());
      }
    }
    if(this.value2 instanceof Variable){
      if(!substitutionSet.get(this.value2)){
        substitutionSet.add(this.value2, generateRuntimeVariable());
      }
    }
  }

  getRuntimeInstance(substitutionSet){
    var newUnion = {callObject:null};

    if(this.value1 instanceof Variable){
      newUnion.value1 = substitutionSet.get(this.value1);
    } else {
      newUnion.value1 = this.value1;
    }
    if(this.value2 instanceof Variable){
      newUnion.value2 = substitutionSet.get(this.value2);
    } else {
      newUnion.value2 = this.value2;
    }

    return new GreaterThanStatement(newUnion);
  }

  toString(){
    return ">(" + this.value1.toString() + ", " + this.value2.toString() + ")";
  }

  * unify(substitutionSet){
    //console.log(this, substitutionSet.toString())
    var value1 = this.value1;
    var value2 = this.value2;

    if(value1 instanceof Variable){
      value1 = substitutionSet.get(value1) || value1;
    }
    if(value2 instanceof Variable){
      value2 = substitutionSet.get(value2) || value2;
    }

    if(value1 instanceof NumberAtom && value2 instanceof NumberAtom && value1.toNumber() > value2.toNumber()){
      yield substitutionSet;
    }
  }

}

class GreaterThanEqualStatement{
  constructor({value1, value2, raw}){
    this.value1 = value1;
    this.value2 = value2;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.value1 instanceof Variable){
      if(!substitutionSet.get(this.value1)){
        substitutionSet.add(this.value1, generateRuntimeVariable());
      }
    }
    if(this.value2 instanceof Variable){
      if(!substitutionSet.get(this.value2)){
        substitutionSet.add(this.value2, generateRuntimeVariable());
      }
    }
  }

  getRuntimeInstance(substitutionSet){
    var newUnion = {callObject:null};

    if(this.value1 instanceof Variable){
      newUnion.value1 = substitutionSet.get(this.value1);
    } else {
      newUnion.value1 = this.value1;
    }
    if(this.value2 instanceof Variable){
      newUnion.value2 = substitutionSet.get(this.value2);
    } else {
      newUnion.value2 = this.value2;
    }

    return new GreaterThanEqualStatement(newUnion);
  }

  toString(){
    return ">=(" + this.value1.toString() + ", " + this.value2.toString() + ")";
  }

  * unify(substitutionSet){
    //console.log(this, substitutionSet.toString())
    var value1 = this.value1;
    var value2 = this.value2;

    if(value1 instanceof Variable){
      value1 = substitutionSet.get(value1) || value1;
    }
    if(value2 instanceof Variable){
      value2 = substitutionSet.get(value2) || value2;
    }

    if(value1 instanceof NumberAtom && value2 instanceof NumberAtom && value1.toNumber() >= value2.toNumber()){
      yield substitutionSet;
    }
  }

}
class LessThanStatement{
  constructor({value1, value2, raw}){
    this.value1 = value1;
    this.value2 = value2;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.value1 instanceof Variable){
      if(!substitutionSet.get(this.value1)){
        substitutionSet.add(this.value1, generateRuntimeVariable());
      }
    }
    if(this.value2 instanceof Variable){
      if(!substitutionSet.get(this.value2)){
        substitutionSet.add(this.value2, generateRuntimeVariable());
      }
    }
  }

  getRuntimeInstance(substitutionSet){
    var newUnion = {callObject:null};

    if(this.value1 instanceof Variable){
      newUnion.value1 = substitutionSet.get(this.value1);
    } else {
      newUnion.value1 = this.value1;
    }
    if(this.value2 instanceof Variable){
      newUnion.value2 = substitutionSet.get(this.value2);
    } else {
      newUnion.value2 = this.value2;
    }

    return new LessThanStatement(newUnion);
  }

  toString(){
    return "<(" + this.value1.toString() + ", " + this.value2.toString() + ")";
  }

  * unify(substitutionSet){
    //console.log(this, substitutionSet.toString())
    var value1 = this.value1;
    var value2 = this.value2;

    if(value1 instanceof Variable){
      value1 = substitutionSet.get(value1) || value1;
    }
    if(value2 instanceof Variable){
      value2 = substitutionSet.get(value2) || value2;
    }

    if(value1 instanceof NumberAtom && value2 instanceof NumberAtom && value1.toNumber() < value2.toNumber()){
      yield substitutionSet;
    }
  }

}
class LessThanEqualStatement{
  constructor({value1, value2, raw}){
    this.value1 = value1;
    this.value2 = value2;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.value1 instanceof Variable){
      if(!substitutionSet.get(this.value1)){
        substitutionSet.add(this.value1, generateRuntimeVariable());
      }
    }
    if(this.value2 instanceof Variable){
      if(!substitutionSet.get(this.value2)){
        substitutionSet.add(this.value2, generateRuntimeVariable());
      }
    }
  }

  getRuntimeInstance(substitutionSet){
    var newUnion = {callObject:null};

    if(this.value1 instanceof Variable){
      newUnion.value1 = substitutionSet.get(this.value1);
    } else {
      newUnion.value1 = this.value1;
    }
    if(this.value2 instanceof Variable){
      newUnion.value2 = substitutionSet.get(this.value2);
    } else {
      newUnion.value2 = this.value2;
    }

    return new LessThanEqualStatement(newUnion);
  }

  toString(){
    return "<=(" + this.value1.toString() + ", " + this.value2.toString() + ")";
  }

  * unify(substitutionSet){
    //console.log(this, substitutionSet.toString())
    var value1 = this.value1;
    var value2 = this.value2;

    if(value1 instanceof Variable){
      value1 = substitutionSet.get(value1) || value1;
    }
    if(value2 instanceof Variable){
      value2 = substitutionSet.get(value2) || value2;
    }

    if(value1 instanceof NumberAtom && value2 instanceof NumberAtom && value1.toNumber() <= value2.toNumber()){
      yield substitutionSet;
    }
  }

}

module.exports  = {
  AndStatements:AndStatements,
  OrStatements: OrStatements,
  UnionStatement: UnionStatement,
  HornClause: HornClause,
  PredicateStatement: PredicateStatement,
  NotStatement: NotStatement,
  SystemCallStatement: SystemCallStatement,
  AddStatement:AddStatement,
  OnceStatement:OnceStatement,
  CallStatement: CallStatement,
  ApplyStatement: ApplyStatement,
  FunctorStatement: FunctorStatement,
  AllSolutionsStatement: AllSolutionsStatement,
  FindAllStatement: FindAllStatement,
  BagOfStatement: BagOfStatement,
  SetOfStatement: SetOfStatement,
  ForallStatement: ForallStatement,
  createBuiltInPredicateStatement: createBuiltInPredicateStatement,
  GreaterThanStatement: GreaterThanStatement,
  GreaterThanEqualStatement: GreaterThanEqualStatement,
  LessThanStatement: LessThanStatement,
  LessThanEqualStatement: LessThanEqualStatement,
  MultiplyStatement: MultiplyStatement
}
