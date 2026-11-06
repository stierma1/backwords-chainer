
var {unify, unifyWithOccursCheck, andUnify, SubstitutionSet} = require("./unification");
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

  * unify(substitutionSet, control){
    control = control || {cut:false};
    var [headStatement, ...tailStatements] = this.subStatements;
    if(this.subStatements.length === 0) {
      yield substitutionSet;
    } else if(tailStatements.length === 0){
      yield* headStatement.unify(substitutionSet, control);
      return;
    } else {
      var cutBefore = control.cut;
      var headStatementGen = headStatement.unify(substitutionSet, control);
      var andState = new AndStatements({subStatements:tailStatements});

      var {value, done} = headStatementGen.next();

      while(!done){
        if(value !== null && value !== undefined){
          var tailsStatementsGen = andState.unify(andUnify([substitutionSet,value]), control);
          var tailObj = tailsStatementsGen.next();
          var value1 = tailObj.value;
          var done1 = tailObj.done;

          while(!done1){
            if(value1 !== null && value1 !== undefined){
              var retValue = andUnify([substitutionSet, value, value1]);
              if(retValue !== null){
                yield retValue;
              }
            }
            tailObj = tailsStatementsGen.next();
            value1 = tailObj.value;
            done1 = tailObj.done;
          }
        }

        if(!cutBefore && control.cut){
          break;
        }

        var next = headStatementGen.next();
        value = next.value;
        done = next.done;
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

  * unify(substitutionSet, control){
    control = control || {cut:false};
    var cutBefore = control.cut;
    for(var i = 0; i < this.subStatements.length; i++){
      var unionGen = this.subStatements[i].unify(substitutionSet, control);
      var {value, done} = unionGen.next();
      while(!done){
        if(value !== null && value !== undefined){
          yield value;
        }
        var next = unionGen.next();
        value = next.value;
        done = next.done;
      }
      if(!cutBefore && control.cut){
        return;
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

class CutStatement {
  constructor({raw} = {}){
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new CutStatement({raw:this.raw});
  }

  * unify(substitutionSet, control){
    if(control){
      control.cut = true;
    }
    yield substitutionSet;
  }

  toString(){
    return "!";
  }
}

class TrueStatement {
  constructor({raw} = {}){
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new TrueStatement({raw:this.raw});
  }

  * unify(substitutionSet){
    yield substitutionSet;
  }

  toString(){
    return "true";
  }
}

class FailStatement {
  constructor({raw} = {}){
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new FailStatement({raw:this.raw});
  }

  * unify(substitutionSet){
  }

  toString(){
    return "fail";
  }
}

class IfThenElseStatement {
  constructor({condition, thenStatement, elseStatement, raw}){
    this.condition = condition;
    this.thenStatement = thenStatement;
    this.elseStatement = elseStatement;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    [this.condition, this.thenStatement, this.elseStatement].forEach(function(term){
      if(term && typeof(term.getRuntimeSubstitution) === "function"){
        term.getRuntimeSubstitution(substitutionSet);
      }
    });
  }

  getRuntimeInstance(substitutionSet){
    var resolve = function(term){
      if(!term){
        return term;
      }
      if(term instanceof Variable){
        return substitutionSet.get(term) || term;
      }
      if(typeof(term.getRuntimeInstance) === "function"){
        return term.getRuntimeInstance(substitutionSet);
      }
      return term;
    };

    return new IfThenElseStatement({
      condition:resolve(this.condition),
      thenStatement:resolve(this.thenStatement),
      elseStatement:resolve(this.elseStatement),
      raw:this.raw
    });
  }

  * unify(substitutionSet, control){
    var conditionControl = {cut:false};
    var conditionGen = this.condition.unify(substitutionSet, conditionControl);
    var conditionResult = null;
    var next = conditionGen.next();

    while(!next.done){
      if(next.value !== null && next.value !== undefined){
        conditionResult = next.value;
        break;
      }
      next = conditionGen.next();
    }

    if(typeof(conditionGen.return) === "function"){
      conditionGen.return();
    }

    if(conditionResult){
      var merged = conditionResult === substitutionSet ? conditionResult : andUnify([substitutionSet, conditionResult]);
      if(!merged){
        return;
      }
      yield* this.thenStatement.unify(merged, control);
    } else if(this.elseStatement){
      yield* this.elseStatement.unify(substitutionSet, control);
    }
  }

  toString(){
    var elsePart = this.elseStatement ? " ; " + this.elseStatement.toString() : "";
    return "(" + this.condition.toString() + " -> " + this.thenStatement.toString() + elsePart + ")";
  }
}

class ExistentialStatement {
  constructor({variable, statement, raw}){
    this.variable = variable;
    this.statement = statement;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.variable instanceof Variable && !substitutionSet.get(this.variable)){
      substitutionSet.add(this.variable, generateRuntimeVariable());
    }
    if(this.statement && typeof(this.statement.getRuntimeSubstitution) === "function"){
      this.statement.getRuntimeSubstitution(substitutionSet);
    }
  }

  getRuntimeInstance(substitutionSet){
    var variable = this.variable instanceof Variable ? (substitutionSet.get(this.variable) || this.variable) : this.variable;
    var statement = this.statement && typeof(this.statement.getRuntimeInstance) === "function" ?
      this.statement.getRuntimeInstance(substitutionSet) : this.statement;

    return new ExistentialStatement({variable:variable, statement:statement, raw:this.raw});
  }

  * unify(substitutionSet, control){
    yield* this.statement.unify(substitutionSet, control);
  }

  toString(){
    return this.variable.toString() + "^" + this.statement.toString();
  }
}

class CallStatement {
  constructor({statement, arguments:callArguments, hornClauses, raw}){
    this.statement = statement;
    this.arguments = callArguments || [];
    this.hornClauses = hornClauses;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.statement && typeof(this.statement.getRuntimeSubstitution) === "function"){
      this.statement.getRuntimeSubstitution(substitutionSet);
    } else if(this.statement instanceof Variable && !substitutionSet.get(this.statement)){
      substitutionSet.add(this.statement, generateRuntimeVariable());
    }

    this.arguments.forEach(function(argument){
      if(argument && typeof(argument.getRuntimeSubstitution) === "function"){
        argument.getRuntimeSubstitution(substitutionSet);
      } else if(argument instanceof Variable && !substitutionSet.get(argument)){
        substitutionSet.add(argument, generateRuntimeVariable());
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

    return new CallStatement({
      statement:resolve(this.statement),
      arguments:this.arguments.map(resolve),
      hornClauses:this.hornClauses,
      raw:this.raw
    });
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

    if(!(statement instanceof Predicate)){
      return null;
    }

    if(this.arguments.length === 0){
      return statement;
    }

    return new Predicate({
      name:statement.name,
      argsList:statement.argsList.concat(this.arguments)
    });
  }
  toString(){
    var args = [this.statement.toString()].concat(this.arguments.map(function(arg){ return arg.toString(); }));
    return "call(" + args.join(", ") + ")";
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
  } else if(term instanceof ExistentialStatement){
    collectVariableNames(term.variable, names);
    collectVariableNames(term.statement, names);
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

function listWithTail(items, tail){
  var result = tail;
  for(var i = items.length - 1; i >= 0; i--){
    result = new List({argsList:[items[i], result]});
  }
  return result;
}

class AllSolutionsStatement {
  constructor({template, goal, bag, tail, hornClauses, goalSolver, mode, raw}){
    this.template = template;
    this.goal = goal;
    this.bag = bag;
    this.tail = tail;
    this.hornClauses = hornClauses;
    this.goalSolver = goalSolver;
    this.mode = mode || "findall";
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    [this.template, this.goal, this.bag, this.tail].forEach(function(term){
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
      tail:resolve(this.tail),
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
      var resultList = this.tail ? listWithTail(items, this.tail) : List.fromArray(items);
      var merged = andUnify([substitutionSet, unify(this.bag, resultList)]);
      if(merged){
        yield merged;
      }
      return;
    }

    if(records.length === 0){
      return;
    }

    var templateVariables = collectVariableNames(this.template, {});
    var existentialVariables = {};
    var variableGoal = this.goal;
    while(variableGoal instanceof ExistentialStatement){
      if(variableGoal.variable instanceof Variable){
        existentialVariables[variableGoal.variable.name] = true;
      }
      variableGoal = variableGoal.statement;
    }
    var goalVariables = collectVariableNames(variableGoal, {});
    var freeVariableNames = Object.keys(goalVariables).filter((name) => {
      return !templateVariables[name] && !existentialVariables[name] && substitutionSet.get(name) === undefined;
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

function isTrueUnion(statement){
  return statement instanceof UnionStatement &&
    statement.subject instanceof Atom &&
    statement.subject.name === "true" &&
    statement.object instanceof Atom &&
    statement.object.name === "true";
}

function isFactClause(clause){
  if(!clause || !clause.body){
    return true;
  }
  if(clause.body instanceof AndStatements){
    return clause.body.subStatements.length === 0 ||
      (clause.body.subStatements.length === 1 && isTrueUnion(clause.body.subStatements[0]));
  }
  return false;
}

function makeFactClause(head){
  return new HornClause({
    head:head,
    body:new AndStatements({subStatements:[]})
  });
}

function addClauseToDatabase(hornClauses, clause, position){
  var name = clause.head.name;
  var arity = clause.head.argsList.length;
  hornClauses[name] = hornClauses[name] || {};
  hornClauses[name][arity] = hornClauses[name][arity] || [];

  if(position === "a"){
    hornClauses[name][arity].unshift(clause);
  } else {
    hornClauses[name][arity].push(clause);
  }
}

function removeClauseGroup(hornClauses, name, arity){
  if(hornClauses[name]){
    delete hornClauses[name][arity];
    if(Object.keys(hornClauses[name]).length === 0){
      delete hornClauses[name];
    }
  }
}

function statementToTerm(statement){
  if(statement instanceof PredicateStatement){
    return statement.predicate;
  }
  if(statement instanceof AndStatements){
    if(statement.subStatements.length === 0){
      return new Predicate({name:"true", argsList:[]});
    }
    if(statement.subStatements.length === 1){
      return statementToTerm(statement.subStatements[0]);
    }
    return new Predicate({
      name:",",
      argsList:[
        statementToTerm(statement.subStatements[0]),
        statementToTerm(new AndStatements({subStatements:statement.subStatements.slice(1)}))
      ]
    });
  }
  if(statement instanceof OrStatements){
    if(statement.subStatements.length === 0){
      return new Predicate({name:"fail", argsList:[]});
    }
    if(statement.subStatements.length === 1){
      return statementToTerm(statement.subStatements[0]);
    }
    return new Predicate({
      name:";",
      argsList:[
        statementToTerm(statement.subStatements[0]),
        statementToTerm(new OrStatements({subStatements:statement.subStatements.slice(1)}))
      ]
    });
  }
  if(statement instanceof UnionStatement){
    return new Predicate({name:"=", argsList:[statement.subject, statement.object]});
  }
  if(statement instanceof NotStatement){
    return new Predicate({name:"not", argsList:[statementToTerm(statement.subStatement)]});
  }
  if(statement instanceof OnceStatement){
    return new Predicate({name:"once", argsList:[statementToTerm(statement.statement)]});
  }
  if(statement instanceof CutStatement){
    return new Atom({name:"!"});
  }
  if(statement instanceof SystemCallStatement){
    return statement.callObject;
  }
  if(statement && typeof(statement.toString) === "function"){
    return new Atom({name:statement.toString()});
  }
  return new Predicate({name:"true", argsList:[]});
}

function clauseBodyToTerm(clause){
  if(isFactClause(clause)){
    return new Predicate({name:"true", argsList:[]});
  }
  return statementToTerm(clause.body);
}

class AssertStatement {
  constructor({clause, hornClauses, position, raw}){
    this.clause = clause;
    this.hornClauses = hornClauses;
    this.position = position || "z";
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.clause && this.clause instanceof Variable && !substitutionSet.get(this.clause)){
      substitutionSet.add(this.clause, generateRuntimeVariable());
    }
  }

  getRuntimeInstance(substitutionSet){
    var clause = this.clause;
    if(clause instanceof HornClause){
      clause = clause.getRuntimeInstance();
    } else if(clause instanceof Predicate){
      clause = clause.getRuntimeInstance(substitutionSet);
    } else if(clause instanceof Variable){
      clause = resolveTerm(clause, substitutionSet);
    }

    return new AssertStatement({
      clause:clause,
      hornClauses:this.hornClauses,
      position:this.position,
      raw:this.raw
    });
  }

  * unify(substitutionSet){
    var clause = this.clause;

    if(clause instanceof Variable){
      clause = resolveTerm(clause, substitutionSet);
    }

    if(clause instanceof Atom && !(clause instanceof Predicate)){
      clause = new Predicate({name:clause.name, argsList:[]});
    }

    if(clause instanceof Predicate){
      clause = makeFactClause(clause.deepCopyWithReplace(substitutionSet));
    }

    if(!(clause instanceof HornClause)){
      return;
    }

    addClauseToDatabase(this.hornClauses, clause, this.position);
    yield substitutionSet;
  }

  toString(){
    return "assert(" + (this.clause ? this.clause.toString() : "") + ")";
  }
}

class RetractStatement {
  constructor({pattern, hornClauses, raw}){
    this.pattern = pattern;
    this.hornClauses = hornClauses;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.pattern && this.pattern instanceof Variable && !substitutionSet.get(this.pattern)){
      substitutionSet.add(this.pattern, generateRuntimeVariable());
    }
  }

  getRuntimeInstance(substitutionSet){
    var pattern = this.pattern;
    if(pattern instanceof HornClause){
      pattern = pattern.getRuntimeInstance();
    } else if(pattern instanceof Predicate){
      pattern = pattern.getRuntimeInstance(substitutionSet);
    } else if(pattern instanceof Variable){
      pattern = resolveTerm(pattern, substitutionSet);
    }

    return new RetractStatement({
      pattern:pattern,
      hornClauses:this.hornClauses,
      raw:this.raw
    });
  }

  * unify(substitutionSet){
    var pattern = this.pattern;

    if(pattern instanceof Variable){
      pattern = resolveTerm(pattern, substitutionSet);
    }

    if(pattern instanceof Atom && !(pattern instanceof Predicate)){
      pattern = new Predicate({name:pattern.name, argsList:[]});
    }

    var patternHead = null;
    if(pattern instanceof Predicate){
      patternHead = pattern.deepCopyWithReplace(substitutionSet);
    } else if(pattern instanceof HornClause){
      patternHead = pattern.head;
    }

    if(!patternHead){
      return;
    }

    var clausesByName = this.hornClauses[patternHead.name];
    var clauses = clausesByName && clausesByName[patternHead.argsList.length];
    if(!clauses){
      return;
    }

    for(var i = 0; i < clauses.length; i++){
      var clause = clauses[i];
      var merged = andUnify([substitutionSet, unify(patternHead, clause.head)]);
      if(!merged){
        continue;
      }

      if(pattern instanceof HornClause){
        if(isFactClause(pattern)){
          if(!isFactClause(clause)){
            continue;
          }
        } else {
          var bodyMatch = andUnify([merged, unify(clauseBodyToTerm(pattern), clauseBodyToTerm(clause))]);
          if(!bodyMatch){
            continue;
          }
          merged = bodyMatch;
        }
      } else if(!isFactClause(clause)){
        continue;
      }

      clauses.splice(i, 1);
      if(clauses.length === 0){
        removeClauseGroup(this.hornClauses, patternHead.name, patternHead.argsList.length);
      }
      yield merged;
      return;
    }
  }

  toString(){
    return "retract(" + (this.pattern ? this.pattern.toString() : "") + ")";
  }
}

class AbolishStatement {
  constructor({argument, hornClauses, raw}){
    this.argument = argument;
    this.hornClauses = hornClauses;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    var argument = this.argument instanceof Variable ? resolveTerm(this.argument, substitutionSet) : this.argument;
    return new AbolishStatement({argument:argument, hornClauses:this.hornClauses, raw:this.raw});
  }

  * unify(substitutionSet){
    var argument = this.argument instanceof Variable ? resolveTerm(this.argument, substitutionSet) : this.argument;
    var name = null;
    var arity = null;

    if(argument instanceof Predicate && argument.name === "/" && argument.argsList.length === 2){
      var nameTerm = resolveTerm(argument.argsList[0], substitutionSet);
      var arityTerm = resolveTerm(argument.argsList[1], substitutionSet);
      if(nameTerm instanceof Atom){
        name = nameTerm.name;
      }
      if(arityTerm instanceof NumberAtom){
        arity = arityTerm.toNumber();
      }
    }

    if(name === null || arity === null || Math.floor(arity) !== arity){
      return;
    }

    removeClauseGroup(this.hornClauses, name, arity);
    yield substitutionSet;
  }

  toString(){
    return "abolish(" + (this.argument ? this.argument.toString() : "") + ")";
  }
}

class ClauseStatement {
  constructor({head, body, hornClauses, raw}){
    this.head = head;
    this.body = body;
    this.hornClauses = hornClauses;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.head && this.head instanceof Variable && !substitutionSet.get(this.head)){
      substitutionSet.add(this.head, generateRuntimeVariable());
    }
    if(this.body && this.body instanceof Variable && !substitutionSet.get(this.body)){
      substitutionSet.add(this.body, generateRuntimeVariable());
    }
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

    return new ClauseStatement({
      head:resolve(this.head),
      body:resolve(this.body),
      hornClauses:this.hornClauses,
      raw:this.raw
    });
  }

  * unify(substitutionSet){
    var head = this.head instanceof Variable ? resolveTerm(this.head, substitutionSet) : this.head;

    if(head instanceof Atom && !(head instanceof Predicate)){
      head = new Predicate({name:head.name, argsList:[]});
    }

    if(!(head instanceof Predicate)){
      return;
    }

    var clausesByName = this.hornClauses[head.name];
    var clauses = clausesByName && clausesByName[head.argsList.length];
    if(!clauses){
      return;
    }

    for(var i = 0; i < clauses.length; i++){
      var clause = clauses[i].getRuntimeInstance();
      var mergedHead = andUnify([substitutionSet, unify(head.deepCopyWithReplace(substitutionSet), clause.head)]);
      if(!mergedHead){
        continue;
      }

      var body = this.body;
      if(body instanceof Atom && !(body instanceof Predicate)){
        body = new Predicate({name:body.name, argsList:[]});
      }

      var merged = andUnify([mergedHead, unify(body, clauseBodyToTerm(clause))]);
      if(merged){
        yield merged;
      }
    }
  }

  toString(){
    return "clause(" + this.head.toString() + ", " + this.body.toString() + ")";
  }
}

function applySubstitution(term, substitutionSet, seen){
  seen = seen || {};

  if(term instanceof Variable){
    if(seen[term.name]){
      return term;
    }
    var replacement = substitutionSet.get(term.name);
    if(replacement === undefined){
      return term;
    }
    seen[term.name] = true;
    var resolved = applySubstitution(replacement, substitutionSet, seen);
    delete seen[term.name];
    return resolved;
  }

  if(term instanceof Predicate){
    return new term.constructor({
      name:term.name,
      argsList:term.argsList.map(function(arg){
        return applySubstitution(arg, substitutionSet, seen);
      })
    });
  }

  return term;
}

function evaluateArithmetic(term, substitutionSet){
  var resolved = applySubstitution(term, substitutionSet);

  if(resolved instanceof NumberAtom){
    return resolved;
  }

  if(!(resolved instanceof Predicate) || resolved.name !== "expr"){
    return null;
  }

  var op = resolved.argsList[0];
  if(!(op instanceof Atom)){
    return null;
  }

  var values = [];
  for(var i = 1; i < resolved.argsList.length; i++){
    var value = evaluateArithmetic(resolved.argsList[i], substitutionSet);
    if(!value){
      return null;
    }
    values.push(value);
  }

  var result = null;

  if(op.name === "neg" && values.length === 1){
    var negBig = values[0].toBigInt();
    result = negBig !== null ? -negBig : -values[0].toNumber();
  } else if(values.length === 2){
    var left = values[0];
    var right = values[1];
    var leftBig = left.toBigInt();
    var rightBig = right.toBigInt();
    var bothIntegers = leftBig !== null && rightBig !== null;

    if(op.name === "add"){
      result = bothIntegers ? leftBig + rightBig : left.toNumber() + right.toNumber();
    } else if(op.name === "sub"){
      result = bothIntegers ? leftBig - rightBig : left.toNumber() - right.toNumber();
    } else if(op.name === "mul"){
      result = bothIntegers ? leftBig * rightBig : left.toNumber() * right.toNumber();
    } else if(op.name === "div"){
      if(bothIntegers){
        if(rightBig === BigInt(0)){
          return null;
        }
        if(leftBig % rightBig === BigInt(0)){
          result = leftBig / rightBig;
        } else {
          result = left.toNumber() / right.toNumber();
        }
      } else {
        if(right.toNumber() === 0){
          return null;
        }
        result = left.toNumber() / right.toNumber();
      }
    } else if(op.name === "idiv"){
      if(bothIntegers){
        if(rightBig === BigInt(0)){
          return null;
        }
        result = leftBig / rightBig;
      } else {
        if(right.toNumber() === 0){
          return null;
        }
        result = Math.trunc(left.toNumber() / right.toNumber());
      }
    } else if(op.name === "mod"){
      if(bothIntegers){
        if(rightBig === BigInt(0)){
          return null;
        }
        result = leftBig % rightBig;
      } else {
        if(right.toNumber() === 0){
          return null;
        }
        result = left.toNumber() % right.toNumber();
      }
    } else if(op.name === "pow"){
      if(bothIntegers && rightBig >= BigInt(0) && rightBig <= BigInt(100000)){
        result = leftBig ** rightBig;
      } else {
        result = Math.pow(left.toNumber(), right.toNumber());
      }
    }
  }

  if(result === null){
    return null;
  }

  if(typeof result !== "bigint" && !isFinite(result)){
    return null;
  }

  return new NumberAtom({name:String(result)});
}

class IsStatement {
  constructor({target, expression, raw}){
    this.target = target;
    this.expression = expression;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.target instanceof Variable && !substitutionSet.get(this.target)){
      substitutionSet.add(this.target, generateRuntimeVariable());
    }
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

    return new IsStatement({
      target:resolve(this.target),
      expression:resolve(this.expression),
      raw:this.raw
    });
  }

  * unify(substitutionSet){
    var value = evaluateArithmetic(this.expression, substitutionSet);
    if(!value){
      return;
    }

    var merged = andUnify([substitutionSet, unify(this.target, value)]);
    if(merged){
      yield merged;
    }
  }

  toString(){
    return "is(" + this.target.toString() + ", " + this.expression.toString() + ")";
  }
}

class ArithmeticComparisonStatement {
  constructor({operator, left, right, raw}){
    this.operator = operator;
    this.left = left;
    this.right = right;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new ArithmeticComparisonStatement({
      operator:this.operator,
      left:this.left,
      right:this.right,
      raw:this.raw
    });
  }

  * unify(substitutionSet){
    var left = evaluateArithmetic(this.left, substitutionSet);
    var right = evaluateArithmetic(this.right, substitutionSet);
    if(!left || !right){
      return;
    }

    var leftBig = left.toBigInt();
    var rightBig = right.toBigInt();
    var comparison = 0;

    if(leftBig !== null && rightBig !== null){
      comparison = leftBig < rightBig ? -1 : (leftBig > rightBig ? 1 : 0);
    } else {
      var l = left.toNumber();
      var r = right.toNumber();
      comparison = l < r ? -1 : (l > r ? 1 : 0);
    }

    var success = false;

    if(this.operator === "=:=" || this.operator === "eq"){
      success = comparison === 0;
    } else if(this.operator === "=\\=" || this.operator === "neq"){
      success = comparison !== 0;
    } else if(this.operator === "=<" || this.operator === "le"){
      success = comparison <= 0;
    } else if(this.operator === ">=" || this.operator === "ge"){
      success = comparison >= 0;
    } else if(this.operator === "<" || this.operator === "lt"){
      success = comparison < 0;
    } else if(this.operator === ">" || this.operator === "gt"){
      success = comparison > 0;
    }

    if(success){
      yield substitutionSet;
    }
  }

  toString(){
    return "arithCompare(" + this.operator + ", " + this.left.toString() + ", " + this.right.toString() + ")";
  }
}

class NotUnifiableStatement {
  constructor({left, right, raw}){
    this.left = left;
    this.right = right;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new NotUnifiableStatement({left:this.left, right:this.right, raw:this.raw});
  }

  * unify(substitutionSet){
    var left = applySubstitution(this.left, substitutionSet);
    var right = applySubstitution(this.right, substitutionSet);

    if(unify(left, right) === null){
      yield substitutionSet;
    }
  }

  toString(){
    return "notUnifiable(" + this.left.toString() + ", " + this.right.toString() + ")";
  }
}

class DifStatement {
  constructor({left, right, raw}){
    this.left = left;
    this.right = right;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new DifStatement({left:this.left, right:this.right, raw:this.raw});
  }

  * unify(substitutionSet){
    var next = substitutionSet.reunion(new SubstitutionSet({}));
    next.addConstraint(this.left, this.right);
    var checked = andUnify([next]);
    if(checked){
      yield checked;
    }
  }

  toString(){
    return "dif(" + this.left.toString() + ", " + this.right.toString() + ")";
  }
}

class UnifyWithOccursCheckStatement {
  constructor({left, right, raw}){
    this.left = left;
    this.right = right;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new UnifyWithOccursCheckStatement({left:this.left, right:this.right, raw:this.raw});
  }

  * unify(substitutionSet){
    var left = applySubstitution(this.left, substitutionSet);
    var right = applySubstitution(this.right, substitutionSet);
    var merged = andUnify([substitutionSet, unifyWithOccursCheck(left, right)]);
    if(merged){
      yield merged;
    }
  }

  toString(){
    return "unify_with_occurs_check(" + this.left.toString() + ", " + this.right.toString() + ")";
  }
}

function termIsGround(term){
  if(term instanceof Variable){
    return false;
  }
  if(term instanceof Predicate){
    return term.argsList.every(termIsGround);
  }
  return true;
}

function atomValue(term){
  return (term instanceof Atom && !(term instanceof NumberAtom)) ||
    (term instanceof Predicate && term.argsList.length === 0);
}

function collectTermVariables(term, variables, names){
  if(term instanceof Variable){
    if(!names[term.name]){
      names[term.name] = true;
      variables.push(term);
    }
    return;
  }

  if(term instanceof Predicate){
    for(var i = 0; i < term.argsList.length; i++){
      collectTermVariables(term.argsList[i], variables, names);
    }
  }
}

class TypeCheckStatement {
  constructor({name, term, raw}){
    this.name = name;
    this.term = term;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    if(this.term instanceof Variable && !substitutionSet.get(this.term)){
      substitutionSet.add(this.term, generateRuntimeVariable());
    } else if(this.term && typeof(this.term.getRuntimeSubstitution) === "function"){
      this.term.getRuntimeSubstitution(substitutionSet);
    }
  }

  getRuntimeInstance(substitutionSet){
    var term = this.term;
    if(term instanceof Variable){
      term = substitutionSet.get(term) || term;
    } else if(term && typeof(term.getRuntimeInstance) === "function"){
      term = term.getRuntimeInstance(substitutionSet);
    }
    return new TypeCheckStatement({name:this.name, term:term, raw:this.raw});
  }

  * unify(substitutionSet){
    var term = applySubstitution(this.term, substitutionSet);
    var success = false;

    if(this.name === "var"){
      success = term instanceof Variable;
    } else if(this.name === "nonvar"){
      success = !(term instanceof Variable);
    } else if(this.name === "atom"){
      success = atomValue(term);
    } else if(this.name === "number"){
      success = term instanceof NumberAtom;
    } else if(this.name === "compound"){
      success = term instanceof Predicate && term.argsList.length > 0;
    } else if(this.name === "ground"){
      success = termIsGround(term);
    }

    if(success){
      yield substitutionSet;
    }
  }

  toString(){
    return this.name + "(" + this.term.toString() + ")";
  }
}

class ArgStatement {
  constructor({index, term, arg, raw}){
    this.index = index;
    this.term = term;
    this.arg = arg;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    [this.index, this.term, this.arg].forEach(function(term){
      if(term instanceof Variable && !substitutionSet.get(term)){
        substitutionSet.add(term, generateRuntimeVariable());
      } else if(term && typeof(term.getRuntimeSubstitution) === "function"){
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
    return new ArgStatement({index:resolve(this.index), term:resolve(this.term), arg:resolve(this.arg), raw:this.raw});
  }

  * unify(substitutionSet){
    var index = applySubstitution(this.index, substitutionSet);
    var term = applySubstitution(this.term, substitutionSet);

    if(!(index instanceof NumberAtom) || !(term instanceof Predicate)){
      return;
    }

    var position = index.toNumber();
    if(Math.floor(position) !== position || position < 1 || position > term.argsList.length){
      return;
    }

    var merged = andUnify([substitutionSet, unify(this.arg, term.argsList[position - 1])]);
    if(merged){
      yield merged;
    }
  }

  toString(){
    return "arg(" + this.index.toString() + ", " + this.term.toString() + ", " + this.arg.toString() + ")";
  }
}

class CopyTermStatement {
  constructor({original, copy, raw}){
    this.original = original;
    this.copy = copy;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    [this.original, this.copy].forEach(function(term){
      if(term instanceof Variable && !substitutionSet.get(term)){
        substitutionSet.add(term, generateRuntimeVariable());
      } else if(term && typeof(term.getRuntimeSubstitution) === "function"){
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
    return new CopyTermStatement({original:resolve(this.original), copy:resolve(this.copy), raw:this.raw});
  }

  * unify(substitutionSet){
    var copy = instantiateTerm(this.original, substitutionSet, {});
    var merged = andUnify([substitutionSet, unify(this.copy, copy)]);
    if(merged){
      yield merged;
    }
  }

  toString(){
    return "copy_term(" + this.original.toString() + ", " + this.copy.toString() + ")";
  }
}

class TermVariablesStatement {
  constructor({term, variables, raw}){
    this.term = term;
    this.variables = variables;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    [this.term, this.variables].forEach(function(term){
      if(term instanceof Variable && !substitutionSet.get(term)){
        substitutionSet.add(term, generateRuntimeVariable());
      } else if(term && typeof(term.getRuntimeSubstitution) === "function"){
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
    return new TermVariablesStatement({term:resolve(this.term), variables:resolve(this.variables), raw:this.raw});
  }

  * unify(substitutionSet){
    var term = applySubstitution(this.term, substitutionSet);
    var variables = [];
    collectTermVariables(term, variables, {});
    var merged = andUnify([substitutionSet, unify(this.variables, List.fromArray(variables))]);
    if(merged){
      yield merged;
    }
  }

  toString(){
    return "term_variables(" + this.term.toString() + ", " + this.variables.toString() + ")";
  }
}

class AggregateStatement {
  constructor({template, goal, result, hornClauses, goalSolver, mode, raw}){
    this.template = template;
    this.goal = goal;
    this.result = result;
    this.hornClauses = hornClauses;
    this.goalSolver = goalSolver;
    this.mode = mode || "aggregate";
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    [this.template, this.goal, this.result].forEach(function(term){
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

    return new AggregateStatement({
      template:resolve(this.template),
      goal:resolve(this.goal),
      result:resolve(this.result),
      hornClauses:this.hornClauses,
      goalSolver:this.goalSolver,
      mode:this.mode,
      raw:this.raw
    });
  }

  * unify(substitutionSet){
    var records = collectAllSolutions(this.template, this.goal, substitutionSet, this.hornClauses, this.goalSolver);
    var template = this.template;
    var name = null;
    var argument = null;

    if(template instanceof Atom){
      name = template.name;
    } else if(template instanceof Predicate){
      name = template.name;
      argument = template.argsList[0];
    }

    if(!name){
      return;
    }

    var value = null;

    if(name === "count" && (!template || template.arity === 0 || template instanceof Atom)){
      value = new NumberAtom({name:records.length});
    } else if(name === "sum" || name === "avg" || name === "min" || name === "max"){
      var values = [];
      for(var i = 0; i < records.length; i++){
        var evaluated = evaluateArithmetic(argument, records[i].substitutionSet);
        if(!evaluated){
          return;
        }
        values.push(evaluated);
      }

      if(values.length === 0){
        if(name === "sum" || name === "avg"){
          value = new NumberAtom({name:0});
        }
      } else if(name === "sum" || name === "avg"){
        var total = 0;
        for(var i = 0; i < values.length; i++){
          total += values[i].toNumber();
        }
        value = new NumberAtom({name:name === "avg" ? total / values.length : total});
      } else {
        var selected = values[0];
        for(var i = 1; i < values.length; i++){
          var selectedBig = selected.toBigInt();
          var currentBig = values[i].toBigInt();
          var comparison = 0;
          if(selectedBig !== null && currentBig !== null){
            comparison = selectedBig < currentBig ? -1 : (selectedBig > currentBig ? 1 : 0);
          } else {
            comparison = selected.toNumber() < values[i].toNumber() ? -1 : (selected.toNumber() > values[i].toNumber() ? 1 : 0);
          }
          if((name === "min" && comparison > 0) || (name === "max" && comparison < 0)){
            selected = values[i];
          }
        }
        value = selected;
      }
    } else if(name === "bag" || name === "set"){
      var items = records.map(function(record){
        return instantiateTerm(argument, record.substitutionSet, {});
      });
      if(name === "set"){
        items = sortUniqueTerms(items);
      }
      value = List.fromArray(items);
    }

    if(value === null){
      return;
    }

    var merged = andUnify([substitutionSet, unify(this.result, value)]);
    if(merged){
      yield merged;
    }
  }

  toString(){
    return this.mode + "(" + this.template.toString() + ", " + this.goal.toString() + ", " + this.result.toString() + ")";
  }
}

function integerValue(term){
  if(!(term instanceof NumberAtom)){
    return null;
  }
  return term.toBigInt();
}

function compareNumberAtoms(first, second){
  var firstBig = first.toBigInt();
  var secondBig = second.toBigInt();
  if(firstBig !== null && secondBig !== null){
    return firstBig < secondBig ? -1 : (firstBig > secondBig ? 1 : 0);
  }
  return first.toNumber() < second.toNumber() ? -1 : (first.toNumber() > second.toNumber() ? 1 : 0);
}

function pairKey(term){
  if(term instanceof Predicate && term.name === "-" && term.argsList.length === 2){
    return term.argsList[0];
  }
  var items = properListToArray(term);
  if(items && items.length === 2){
    return items[0];
  }
  return null;
}

class LengthStatement {
  constructor({list, length}){
    this.list = list;
    this.length = length;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new LengthStatement({list:this.list, length:this.length});
  }

  * unify(substitutionSet){
    var list = applySubstitution(this.list, substitutionSet);
    var length = applySubstitution(this.length, substitutionSet);
    var items = properListToArray(list);

    if(items !== null){
      var merged = andUnify([substitutionSet, unify(this.length, new NumberAtom({name:items.length}))]);
      if(merged){
        yield merged;
      }
      return;
    }

    if(list instanceof Variable && length instanceof NumberAtom){
      var count = length.toNumber();
      if(Math.floor(count) !== count || count < 0){
        return;
      }

      var variables = [];
      for(var i = 0; i < count; i++){
        variables.push(generateRuntimeVariable());
      }

      var constructed = andUnify([substitutionSet, unify(this.list, List.fromArray(variables))]);
      if(constructed){
        yield constructed;
      }
    }
  }

  toString(){
    return "length(" + this.list.toString() + ", " + this.length.toString() + ")";
  }
}

class ReverseStatement {
  constructor({list, reversed}){
    this.list = list;
    this.reversed = reversed;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new ReverseStatement({list:this.list, reversed:this.reversed});
  }

  * unify(substitutionSet){
    var list = applySubstitution(this.list, substitutionSet);
    var reversed = applySubstitution(this.reversed, substitutionSet);
    var listItems = properListToArray(list);
    var reversedItems = properListToArray(reversed);

    if(listItems !== null){
      var forward = andUnify([substitutionSet, unify(this.reversed, List.fromArray(listItems.slice().reverse()))]);
      if(forward){
        yield forward;
      }
      return;
    }

    if(reversedItems !== null){
      var backward = andUnify([substitutionSet, unify(this.list, List.fromArray(reversedItems.slice().reverse()))]);
      if(backward){
        yield backward;
      }
    }
  }

  toString(){
    return "reverse(" + this.list.toString() + ", " + this.reversed.toString() + ")";
  }
}

class NthStatement {
  constructor({index, list, element, offset}){
    this.index = index;
    this.list = list;
    this.element = element;
    this.offset = offset;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new NthStatement({index:this.index, list:this.list, element:this.element, offset:this.offset});
  }

  * unify(substitutionSet){
    var list = applySubstitution(this.list, substitutionSet);
    var index = applySubstitution(this.index, substitutionSet);
    var items = properListToArray(list);

    if(items === null){
      return;
    }

    if(index instanceof NumberAtom){
      var position = index.toNumber() - this.offset;
      if(Math.floor(position) !== position || position < 0 || position >= items.length){
        return;
      }
      var merged = andUnify([substitutionSet, unify(this.element, items[position])]);
      if(merged){
        yield merged;
      }
      return;
    }

    if(index instanceof Variable){
      for(var i = 0; i < items.length; i++){
        var result = andUnify([
          substitutionSet,
          unify(this.index, new NumberAtom({name:i + this.offset})),
          unify(this.element, items[i])
        ]);
        if(result){
          yield result;
        }
      }
    }
  }

  toString(){
    return (this.offset === 0 ? "nth0" : "nth1") + "(" + this.index.toString() + ", " +
      this.list.toString() + ", " + this.element.toString() + ")";
  }
}

class LastStatement {
  constructor({list, last}){
    this.list = list;
    this.last = last;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new LastStatement({list:this.list, last:this.last});
  }

  * unify(substitutionSet){
    var items = properListToArray(applySubstitution(this.list, substitutionSet));
    if(!items || items.length === 0){
      return;
    }
    var merged = andUnify([substitutionSet, unify(this.last, items[items.length - 1])]);
    if(merged){
      yield merged;
    }
  }

  toString(){
    return "last(" + this.list.toString() + ", " + this.last.toString() + ")";
  }
}

class BetweenStatement {
  constructor({low, high, value}){
    this.low = low;
    this.high = high;
    this.value = value;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new BetweenStatement({low:this.low, high:this.high, value:this.value});
  }

  * unify(substitutionSet){
    var low = applySubstitution(this.low, substitutionSet);
    var high = applySubstitution(this.high, substitutionSet);
    if(!(low instanceof NumberAtom) || !(high instanceof NumberAtom)){
      return;
    }

    var lowValue = low.toNumber();
    var highValue = high.toNumber();
    if(Math.floor(lowValue) !== lowValue || Math.floor(highValue) !== highValue){
      return;
    }

    var value = applySubstitution(this.value, substitutionSet);
    if(value instanceof NumberAtom){
      var current = value.toNumber();
      if(Math.floor(current) === current && current >= lowValue && current <= highValue){
        yield substitutionSet;
      }
      return;
    }

    if(value instanceof Variable){
      for(var i = lowValue; i <= highValue; i++){
        var merged = andUnify([substitutionSet, unify(this.value, new NumberAtom({name:i}))]);
        if(merged){
          yield merged;
        }
      }
    }
  }

  toString(){
    return "between(" + this.low.toString() + ", " + this.high.toString() + ", " + this.value.toString() + ")";
  }
}

class SuccStatement {
  constructor({first, second}){
    this.first = first;
    this.second = second;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new SuccStatement({first:this.first, second:this.second});
  }

  * unify(substitutionSet){
    var first = applySubstitution(this.first, substitutionSet);
    var second = applySubstitution(this.second, substitutionSet);
    var firstValue = integerValue(first);
    var secondValue = integerValue(second);

    if(firstValue !== null){
      if(firstValue < BigInt(0)){
        return;
      }
      var merged = andUnify([substitutionSet, unify(this.second, new NumberAtom({name:(firstValue + BigInt(1)).toString()}))]);
      if(merged){
        yield merged;
      }
      return;
    }

    if(secondValue !== null && secondValue > BigInt(0)){
      var backward = andUnify([substitutionSet, unify(this.first, new NumberAtom({name:(secondValue - BigInt(1)).toString()}))]);
      if(backward){
        yield backward;
      }
    }
  }

  toString(){
    return "succ(" + this.first.toString() + ", " + this.second.toString() + ")";
  }
}

class SortStatement {
  constructor({mode, list, sorted}){
    this.mode = mode;
    this.list = list;
    this.sorted = sorted;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new SortStatement({mode:this.mode, list:this.list, sorted:this.sorted});
  }

  * unify(substitutionSet){
    var items = properListToArray(applySubstitution(this.list, substitutionSet));
    if(items === null){
      return;
    }

    var sorted;

    if(this.mode === "msort"){
      sorted = items.slice().sort(compareTerms);
    } else if(this.mode === "sort"){
      sorted = sortUniqueTerms(items);
    } else if(this.mode === "keysort"){
      var keyed = [];
      for(var i = 0; i < items.length; i++){
        var key = pairKey(items[i]);
        if(key === null){
          return;
        }
        keyed.push({key:key, item:items[i], index:i});
      }
      keyed.sort(function(first, second){
        var compared = compareTerms(first.key, second.key);
        return compared === 0 ? first.index - second.index : compared;
      });
      sorted = keyed.map(function(entry){ return entry.item; });
    } else {
      return;
    }

    var merged = andUnify([substitutionSet, unify(this.sorted, List.fromArray(sorted))]);
    if(merged){
      yield merged;
    }
  }

  toString(){
    return this.mode + "(" + this.list.toString() + ", " + this.sorted.toString() + ")";
  }
}

class ListNumericStatement {
  constructor({mode, list, result}){
    this.mode = mode;
    this.list = list;
    this.result = result;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new ListNumericStatement({mode:this.mode, list:this.list, result:this.result});
  }

  * unify(substitutionSet){
    var items = properListToArray(applySubstitution(this.list, substitutionSet));
    if(items === null){
      return;
    }

    var values = [];
    for(var i = 0; i < items.length; i++){
      var value = evaluateArithmetic(items[i], substitutionSet);
      if(!value){
        return;
      }
      values.push(value);
    }

    if(values.length === 0 && (this.mode === "min" || this.mode === "max")){
      return;
    }

    var value = null;

    if(this.mode === "sum"){
      var allIntegers = values.every(function(entry){ return entry.toBigInt() !== null; });
      if(allIntegers){
        var total = BigInt(0);
        values.forEach(function(entry){ total = total + entry.toBigInt(); });
        value = new NumberAtom({name:total.toString()});
      } else {
        var numberTotal = 0;
        values.forEach(function(entry){ numberTotal += entry.toNumber(); });
        value = new NumberAtom({name:numberTotal});
      }
    } else {
      value = values[0];
      for(var i = 1; i < values.length; i++){
        var compared = compareNumberAtoms(value, values[i]);
        if((this.mode === "min" && compared > 0) || (this.mode === "max" && compared < 0)){
          value = values[i];
        }
      }
    }

    var merged = andUnify([substitutionSet, unify(this.result, value)]);
    if(merged){
      yield merged;
    }
  }

  toString(){
    return this.mode + "_list(" + this.list.toString() + ", " + this.result.toString() + ")";
  }
}

class MemberChkStatement {
  constructor({element, list}){
    this.element = element;
    this.list = list;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new MemberChkStatement({element:this.element, list:this.list});
  }

  * unify(substitutionSet){
    var items = properListToArray(applySubstitution(this.list, substitutionSet));
    if(items === null){
      return;
    }

    for(var i = 0; i < items.length; i++){
      var merged = andUnify([substitutionSet, unify(this.element, items[i])]);
      if(merged){
        yield merged;
        return;
      }
    }
  }

  toString(){
    return "memberchk(" + this.element.toString() + ", " + this.list.toString() + ")";
  }
}

class SelectChkStatement {
  constructor({element, list, rest}){
    this.element = element;
    this.list = list;
    this.rest = rest;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new SelectChkStatement({element:this.element, list:this.list, rest:this.rest});
  }

  * unify(substitutionSet){
    var items = properListToArray(applySubstitution(this.list, substitutionSet));
    if(items === null){
      return;
    }

    for(var i = 0; i < items.length; i++){
      var merged = andUnify([substitutionSet, unify(this.element, items[i])]);
      if(!merged){
        continue;
      }
      var remaining = items.slice();
      remaining.splice(i, 1);
      var result = andUnify([merged, unify(this.rest, List.fromArray(remaining))]);
      if(result){
        yield result;
        return;
      }
    }
  }

  toString(){
    return "selectchk(" + this.element.toString() + ", " + this.list.toString() + ", " + this.rest.toString() + ")";
  }
}

class MapListStatement {
  constructor({closure, lists, hornClauses}){
    this.closure = closure;
    this.lists = lists;
    this.hornClauses = hornClauses;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new MapListStatement({closure:this.closure, lists:this.lists, hornClauses:this.hornClauses});
  }

  * walk(arrays, index, substitutionSet){
    if(index >= arrays[0].length){
      yield substitutionSet;
      return;
    }

    var call = new CallStatement({
      statement:this.closure,
      arguments:arrays.map(function(array){ return array[index]; }),
      hornClauses:this.hornClauses
    });

    var results = call.unify(substitutionSet);
    for(var result of results){
      if(result){
        yield* this.walk(arrays, index + 1, result);
      }
    }
  }

  * unify(substitutionSet){
    var arrays = [];
    var variableLists = [];
    var knownLength = null;

    for(var i = 0; i < this.lists.length; i++){
      var resolved = applySubstitution(this.lists[i], substitutionSet);
      var items = properListToArray(resolved);

      if(items !== null){
        if(knownLength !== null && items.length !== knownLength){
          return;
        }
        knownLength = items.length;
        arrays[i] = items;
      } else if(resolved instanceof Variable){
        arrays[i] = null;
        variableLists.push(i);
      } else {
        return;
      }
    }

    if(arrays.length === 0){
      yield substitutionSet;
      return;
    }

    if(knownLength === null){
      return;
    }

    for(var i = 0; i < variableLists.length; i++){
      var index = variableLists[i];
      var variables = [];
      for(var j = 0; j < knownLength; j++){
        variables.push(generateRuntimeVariable());
      }
      var merged = andUnify([substitutionSet, unify(this.lists[index], List.fromArray(variables))]);
      if(!merged){
        return;
      }
      substitutionSet = merged;
      arrays[index] = variables;
    }

    yield* this.walk(arrays, 0, substitutionSet);
  }

  toString(){
    return "maplist(" + [this.closure.toString()].concat(this.lists.map(function(list){ return list.toString(); })).join(", ") + ")";
  }
}

class FilterListStatement {
  constructor({mode, closure, list, result, hornClauses}){
    this.mode = mode;
    this.closure = closure;
    this.list = list;
    this.result = result;
    this.hornClauses = hornClauses;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new FilterListStatement({
      mode:this.mode,
      closure:this.closure,
      list:this.list,
      result:this.result,
      hornClauses:this.hornClauses
    });
  }

  * unify(substitutionSet){
    var items = properListToArray(applySubstitution(this.list, substitutionSet));
    if(items === null){
      return;
    }

    var kept = [];
    for(var i = 0; i < items.length; i++){
      var call = new CallStatement({
        statement:this.closure,
        arguments:[items[i]],
        hornClauses:this.hornClauses
      });
      var results = call.unify(substitutionSet);
      var next = results.next();
      var succeeded = !next.done && next.value !== null && next.value !== undefined;
      if(typeof results.return === "function"){
        results.return();
      }

      if((this.mode === "include" && succeeded) || (this.mode === "exclude" && !succeeded)){
        kept.push(items[i]);
      }
    }

    var merged = andUnify([substitutionSet, unify(this.result, List.fromArray(kept))]);
    if(merged){
      yield merged;
    }
  }

  toString(){
    return this.mode + "(" + this.closure.toString() + ", " + this.list.toString() + ", " + this.result.toString() + ")";
  }
}

class FoldlStatement {
  constructor({closure, lists, initial, final, hornClauses}){
    this.closure = closure;
    this.lists = lists;
    this.initial = initial;
    this.final = final;
    this.hornClauses = hornClauses;
  }

  getRuntimeSubstitution(substitutionSet){
  }

  getRuntimeInstance(substitutionSet){
    return new FoldlStatement({
      closure:this.closure,
      lists:this.lists,
      initial:this.initial,
      final:this.final,
      hornClauses:this.hornClauses
    });
  }

  * fold(arrays, index, accumulator, substitutionSet){
    if(index >= arrays[0].length){
      var merged = andUnify([substitutionSet, unify(this.final, accumulator)]);
      if(merged){
        yield merged;
      }
      return;
    }

    var output = generateRuntimeVariable();
    var call = new CallStatement({
      statement:this.closure,
      arguments:arrays.map(function(array){ return array[index]; }).concat([accumulator, output]),
      hornClauses:this.hornClauses
    });

    var results = call.unify(substitutionSet);
    for(var result of results){
      if(result){
        yield* this.fold(arrays, index + 1, applySubstitution(output, result), result);
      }
    }
  }

  * unify(substitutionSet){
    var arrays = [];
    for(var i = 0; i < this.lists.length; i++){
      var items = properListToArray(applySubstitution(this.lists[i], substitutionSet));
      if(items === null){
        return;
      }
      arrays.push(items);
    }

    for(var i = 1; i < arrays.length; i++){
      if(arrays[i].length !== arrays[0].length){
        return;
      }
    }

    if(arrays.length === 0){
      var merged = andUnify([substitutionSet, unify(this.final, this.initial)]);
      if(merged){
        yield merged;
      }
      return;
    }

    yield* this.fold(arrays, 0, applySubstitution(this.initial, substitutionSet), substitutionSet);
  }

  toString(){
    return "foldl(" + [this.closure.toString()].concat(this.lists.map(function(list){ return list.toString(); })).join(", ") + ")";
  }
}

function createBuiltInPredicateStatement(predicate, hornClauses, goalSolver){
  var arity = predicate.argsList.length;

  if(arity === 0 && predicate.name === "true"){
    return new TrueStatement();
  }

  if(arity === 0 && (predicate.name === "fail" || predicate.name === "false")){
    return new FailStatement();
  }

  if(predicate.name === "findall" && arity === 3){
    return new FindAllStatement({
      template:predicate.argsList[0],
      goal:predicate.argsList[1],
      bag:predicate.argsList[2],
      hornClauses:hornClauses,
      goalSolver:goalSolver
    });
  }

  if(predicate.name === "findall" && arity === 4){
    return new FindAllStatement({
      template:predicate.argsList[0],
      goal:predicate.argsList[1],
      bag:predicate.argsList[2],
      tail:predicate.argsList[3],
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

  if(predicate.name === "assert" && arity === 1){
    return new AssertStatement({clause:predicate.argsList[0], hornClauses:hornClauses, position:"z"});
  }

  if(predicate.name === "asserta" && arity === 1){
    return new AssertStatement({clause:predicate.argsList[0], hornClauses:hornClauses, position:"a"});
  }

  if(predicate.name === "assertz" && arity === 1){
    return new AssertStatement({clause:predicate.argsList[0], hornClauses:hornClauses, position:"z"});
  }

  if(predicate.name === "retract" && arity === 1){
    return new RetractStatement({pattern:predicate.argsList[0], hornClauses:hornClauses});
  }

  if(predicate.name === "abolish" && arity === 1){
    return new AbolishStatement({argument:predicate.argsList[0], hornClauses:hornClauses});
  }

  if(predicate.name === "clause" && arity === 2){
    return new ClauseStatement({
      head:predicate.argsList[0],
      body:predicate.argsList[1],
      hornClauses:hornClauses
    });
  }

  if(predicate.name === "is" && arity === 2){
    return new IsStatement({target:predicate.argsList[0], expression:predicate.argsList[1]});
  }

  if(predicate.name === "arithCompare" && arity === 3){
    var operator = predicate.argsList[0] instanceof Atom ? predicate.argsList[0].name : null;
    if(operator){
      return new ArithmeticComparisonStatement({
        operator:operator,
        left:predicate.argsList[1],
        right:predicate.argsList[2]
      });
    }
  }

  if(predicate.name === "notUnifiable" && arity === 2){
    return new NotUnifiableStatement({left:predicate.argsList[0], right:predicate.argsList[1]});
  }

  if(predicate.name === "dif" && arity === 2){
    return new DifStatement({left:predicate.argsList[0], right:predicate.argsList[1]});
  }

  if(predicate.name === "unify_with_occurs_check" && arity === 2){
    return new UnifyWithOccursCheckStatement({left:predicate.argsList[0], right:predicate.argsList[1]});
  }

  if(arity === 1 && ["var", "nonvar", "atom", "number", "compound", "ground"].indexOf(predicate.name) !== -1){
    return new TypeCheckStatement({name:predicate.name, term:predicate.argsList[0]});
  }

  if(predicate.name === "arg" && arity === 3){
    return new ArgStatement({index:predicate.argsList[0], term:predicate.argsList[1], arg:predicate.argsList[2]});
  }

  if(predicate.name === "copy_term" && arity === 2){
    return new CopyTermStatement({original:predicate.argsList[0], copy:predicate.argsList[1]});
  }

  if(predicate.name === "term_variables" && arity === 2){
    return new TermVariablesStatement({term:predicate.argsList[0], variables:predicate.argsList[1]});
  }

  if(predicate.name === "aggregate" && arity === 3){
    return new AggregateStatement({
      template:predicate.argsList[0],
      goal:predicate.argsList[1],
      result:predicate.argsList[2],
      hornClauses:hornClauses,
      goalSolver:goalSolver,
      mode:"aggregate"
    });
  }

  if(predicate.name === "aggregate_all" && arity === 3){
    return new AggregateStatement({
      template:predicate.argsList[0],
      goal:predicate.argsList[1],
      result:predicate.argsList[2],
      hornClauses:hornClauses,
      goalSolver:goalSolver,
      mode:"aggregate_all"
    });
  }

  if(predicate.name === "length" && arity === 2){
    return new LengthStatement({list:predicate.argsList[0], length:predicate.argsList[1]});
  }

  if(predicate.name === "reverse" && arity === 2){
    return new ReverseStatement({list:predicate.argsList[0], reversed:predicate.argsList[1]});
  }

  if(predicate.name === "nth0" && arity === 3){
    return new NthStatement({index:predicate.argsList[0], list:predicate.argsList[1], element:predicate.argsList[2], offset:0});
  }

  if(predicate.name === "nth1" && arity === 3){
    return new NthStatement({index:predicate.argsList[0], list:predicate.argsList[1], element:predicate.argsList[2], offset:1});
  }

  if(predicate.name === "last" && arity === 2){
    return new LastStatement({list:predicate.argsList[0], last:predicate.argsList[1]});
  }

  if(predicate.name === "between" && arity === 3){
    return new BetweenStatement({low:predicate.argsList[0], high:predicate.argsList[1], value:predicate.argsList[2]});
  }

  if(predicate.name === "succ" && arity === 2){
    return new SuccStatement({first:predicate.argsList[0], second:predicate.argsList[1]});
  }

  if((predicate.name === "sort" || predicate.name === "msort" || predicate.name === "keysort") && arity === 2){
    return new SortStatement({mode:predicate.name, list:predicate.argsList[0], sorted:predicate.argsList[1]});
  }

  if((predicate.name === "sum_list" || predicate.name === "max_list" || predicate.name === "min_list") && arity === 2){
    return new ListNumericStatement({
      mode:predicate.name.replace("_list", ""),
      list:predicate.argsList[0],
      result:predicate.argsList[1]
    });
  }

  if(predicate.name === "memberchk" && arity === 2){
    return new MemberChkStatement({element:predicate.argsList[0], list:predicate.argsList[1]});
  }

  if(predicate.name === "selectchk" && arity === 3){
    return new SelectChkStatement({element:predicate.argsList[0], list:predicate.argsList[1], rest:predicate.argsList[2]});
  }

  if(predicate.name === "maplist" && arity >= 2){
    return new MapListStatement({closure:predicate.argsList[0], lists:predicate.argsList.slice(1), hornClauses:hornClauses});
  }

  if((predicate.name === "include" || predicate.name === "exclude") && arity === 3){
    return new FilterListStatement({
      mode:predicate.name,
      closure:predicate.argsList[0],
      list:predicate.argsList[1],
      result:predicate.argsList[2],
      hornClauses:hornClauses
    });
  }

  if(predicate.name === "foldl" && arity >= 4){
    var listCount = arity - 3;
    return new FoldlStatement({
      closure:predicate.argsList[0],
      lists:predicate.argsList.slice(1, 1 + listCount),
      initial:predicate.argsList[arity - 2],
      final:predicate.argsList[arity - 1],
      hornClauses:hornClauses
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
    var gen = (new OrStatements({subStatements:orStatements})).unify(substitutionSet, {cut:false})
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
  CutStatement: CutStatement,
  TrueStatement: TrueStatement,
  FailStatement: FailStatement,
  IfThenElseStatement: IfThenElseStatement,
  ExistentialStatement: ExistentialStatement,
  CallStatement: CallStatement,
  ApplyStatement: ApplyStatement,
  FunctorStatement: FunctorStatement,
  AllSolutionsStatement: AllSolutionsStatement,
  FindAllStatement: FindAllStatement,
  BagOfStatement: BagOfStatement,
  SetOfStatement: SetOfStatement,
  ForallStatement: ForallStatement,
  AssertStatement: AssertStatement,
  RetractStatement: RetractStatement,
  AbolishStatement: AbolishStatement,
  ClauseStatement: ClauseStatement,
  IsStatement: IsStatement,
  ArithmeticComparisonStatement: ArithmeticComparisonStatement,
  NotUnifiableStatement: NotUnifiableStatement,
  DifStatement: DifStatement,
  UnifyWithOccursCheckStatement: UnifyWithOccursCheckStatement,
  createBuiltInPredicateStatement: createBuiltInPredicateStatement,
  GreaterThanStatement: GreaterThanStatement,
  GreaterThanEqualStatement: GreaterThanEqualStatement,
  LessThanStatement: LessThanStatement,
  LessThanEqualStatement: LessThanEqualStatement,
  MultiplyStatement: MultiplyStatement
}
