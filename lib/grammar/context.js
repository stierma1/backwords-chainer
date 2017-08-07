
var {Atom, Predicate, Unification, Variable, Statements, defaultHornClauses, List} = require("../unification");
var generateRuntimeVariable = require("../unification/utils").generateRuntimeVariable
var {AndStatements, NotStatement, OrStatements, UnionStatement,SystemCallStatement, HornClause, PredicateStatement} = Statements;

function createContext(systemCalls){

var [subset1, subset2, subset3] = defaultHornClauses.createSubsetClause()
var hornClauses = [defaultHornClauses.createMemberClause()[0], subset1, subset2, subset3];

function createAtom(atomString){
  return new Atom({name:atomString});
}

function createVariable(variableName){
  return new Variable({name:variableName});
}

function createPredicate({name, argsList}){
  return new Predicate({name, argsList});
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
    return new AndStatements({subStatements:[arg1, arg2]});
  }

  return new AndStatements({subStatements:[arg1]});
}

function createOrStatements(arg1, arg2){
  if(arg2){
    return new OrStatements({subStatements:[arg1, arg2]});
  }

  return new OrStatements({subStatements:[arg1]});
}

function createPredicateStatement(predicate){
  return new PredicateStatement({predicate, hornClauses})
}

function createNotStatement(statements){
  return new NotStatement({subStatement:statements});
}

function createHornClause(head, body){

  if(body){
    var horn = new HornClause({head, body});
    return horn;
  }

  var horn = new HornClause({head, body:createAndStatements(createUnionStatement(new Atom("true"), new Atom("true")))});

  return horn;
}

function createUnionStatement(subject, object){
  return new UnionStatement({subject, object});
}

function createFreeVariable(){
  return generateRuntimeVariable();
}

function SystemCalls(object){
  return new SystemCallStatement(object, systemCalls);
}

return {hornClauses, createFreeVariable, createUnionStatement,
  createHornClause, createNotStatement, createPredicateStatement, createOrStatements,
  createAndStatements,createAtom, createVariable, createPredicate, createList, SystemCalls:SystemCalls};
}

module.exports = createContext;
