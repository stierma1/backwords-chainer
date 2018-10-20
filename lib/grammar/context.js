
var {Atom, StringAtom, Predicate, NumberAtom, Unification, Variable, Statements, defaultHornClauses, List} = require("../unification");
var generateRuntimeVariable = require("../unification/utils").generateRuntimeVariable
var {AndStatements,AddStatement,MultiplyStatement,CallStatement,LessThanStatement,LessThanEqualStatement,GreaterThanStatement,GreaterThanEqualStatement,  NotStatement, OnceStatement, OrStatements, UnionStatement,SystemCallStatement, HornClause, PredicateStatement} = Statements;

function createContext(systemCalls){
var currentObjectBindings = null;
var [subset1, subset2, subset3] = defaultHornClauses.createSubsetClause()
var memberClause = defaultHornClauses.createMemberClause()[0];
var hornClauses = {};//[defaultHornClauses.createMemberClause()[0], subset1, subset2, subset3];
hornClauses["member"] = {};
hornClauses["member"][memberClause.head.argsList.length] = [memberClause];
hornClauses["subset"] = {};
hornClauses["subset"][subset1.head.argsList.length] = [subset1, subset2, subset3];

function createAtom(atomString){
  return new Atom({name:atomString});
}

function createVariable(variableName){
  return new Variable({name:variableName});
}

function createPredicate({name, argsList}){
  return new Predicate({name, argsList});
}

function createString(atomString){
  return new StringAtom({name:atomString});
}

function createList(head, tail){
  if(tail){
    if(tail instanceof Atom && tail.name !== "[]"){
      throw new Error("List tail cannot be an atom:" + tail.toString());
    }
    var list = tail;
    for(var i = head.length - 1; i >= 0; i--){
      list = new List({argsList:[head[i], list]});
    }
    return list;
  } else {
    return List.fromArray(head);
  }
}

function createAndStatements(arg1, arg2){

  if(arg2){
    return new AndStatements({subStatements:[arg1, arg2], raw: arg1.raw + "," + arg2.raw});
  }

  return new AndStatements({subStatements:[arg1], raw:arg1.raw});
}

function createOrStatements(arg1, arg2){
  if(arg2){
    return new OrStatements({subStatements:[arg1, arg2], raw: arg1.raw + ";" + arg2.raw});
  }

  return new OrStatements({subStatements:[arg1], raw:arg1.raw});
}

function createPredicateStatement(predicate){
  return new PredicateStatement({predicate, hornClauses, raw:predicate.toString(true)})
}

function createNotStatement(statements){
  return new NotStatement({subStatement:statements, raw:"not(" + statements.raw + ")"});
}

function createAddStatement(val1, val2, result){
  return new AddStatement({value1:val1, value2:val2, result, raw:"+(" + val1.toString(true) + "," + val2.toString(true) + "," + result.toString(true) + ")"});
}
function createMultiplyStatement(val1, val2, result){
  return new MultiplyStatement({value1:val1, value2:val2, result, raw:"*(" + val1.toString(true) + "," + val2.toString(true) + "," + result.toString(true) + ")"});
}

function createOnceStatement(val){
  return new OnceStatement({statement:val, raw:"once(" + val.raw + ")"});
}

function createHornClause(head, body){

  if(body){
    var horn = new HornClause({head, body, raw: head.toString(true) + " :- " + body.raw});
    return horn;
  }

  var horn = new HornClause({head, raw:head.toString(true) + ".", body:createAndStatements(createUnionStatement(new Atom({name:"true"}), new Atom({name:"true"})))});

  return horn;
}

function createCallStatement(arg){
  return new CallStatement({statement:arg, raw:arg.toString(true)});
}

function createUnionStatement(subject, object){
  return new UnionStatement({subject, object, raw: "=(" + subject.toString(true) + "," + object.toString(true) + ")"});
}

function createFreeVariable(){
  return generateRuntimeVariable();
}

function createNumber(val){
  return new NumberAtom({name:val});
}

function SystemCalls(object){
  return new SystemCallStatement(object, systemCalls, "systemCall(" + (object.raw || object.toString(true)) + ")");
}

function createLessThanStatement(value1, value2){
  return new LessThanStatement({value1, value2});
}
function createLessThanEqualStatement(value1, value2){
  return new LessThanEqualStatement({value1, value2});
}
function createGreaterThanStatement(value1, value2){
  return new GreaterThanStatement({value1, value2});
}
function createGreaterThanEqualStatement(value1, value2){
  return new GreaterThanEqualStatement({value1, value2});
}

function createObjectAtom(objAtomKey){
  if(!currentObjectBindings[objAtomKey]){
    throw new Error("No object matching key: " + objAtomKey);
  }
  return Atom.fromValue(currentObjectBindings[objAtomKey]);
}

function setCurrentObjectBindings(bindings){
  currentObjectBindings = bindings;
}

return {hornClauses, setCurrentObjectBindings,createObjectAtom, createFreeVariable, createUnionStatement, createNumber,
  createHornClause, createString, createNotStatement, createPredicateStatement,createMultiStatement:createMultiplyStatement, createOrStatements, addStatement:createAddStatement,
  createAndStatements,createGreaterThanEqualStatement,createLessThanStatement,createLessThanEqualStatement,createGreaterThanStatement,createCallStatement,createOnceStatement,createAtom, createVariable, createPredicate, createList, SystemCalls:SystemCalls};
}

module.exports = createContext;
