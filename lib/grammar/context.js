
var {Atom, StringAtom, Predicate, NumberAtom, Unification, Variable, Statements, defaultHornClauses, List} = require("../unification");
var generateRuntimeVariable = require("../unification/utils").generateRuntimeVariable
var {AndStatements,AddStatement,MultiplyStatement,CallStatement,ApplyStatement,FunctorStatement,FindAllStatement,BagOfStatement,SetOfStatement,ForallStatement,CutStatement,IfThenElseStatement,ExistentialStatement,AssertStatement,RetractStatement,LessThanStatement,LessThanEqualStatement,GreaterThanStatement,GreaterThanEqualStatement,  NotStatement, OnceStatement, OrStatements, UnionStatement,SystemCallStatement, HornClause, PredicateStatement} = Statements;

function createContext(systemCalls){
var currentObjectBindings = null;
var [subset1, subset2, subset3] = defaultHornClauses.createSubsetClause()
var memberClause = defaultHornClauses.createMemberClause()[0];
var hornClauses = {};//[defaultHornClauses.createMemberClause()[0], subset1, subset2, subset3];
hornClauses["member"] = {};
hornClauses["member"][memberClause.head.argsList.length] = [memberClause];
hornClauses["subset"] = {};
hornClauses["subset"][subset1.head.argsList.length] = [subset1, subset2, subset3];

function unescapeValue(value){
  return value.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|n|r|t|b|f|v|0|\\|'|")/g, function(match, code){
    if(code === "n"){ return "\n"; }
    if(code === "r"){ return "\r"; }
    if(code === "t"){ return "\t"; }
    if(code === "b"){ return "\b"; }
    if(code === "f"){ return "\f"; }
    if(code === "v"){ return "\v"; }
    if(code === "0"){ return "\0"; }
    if(code === "\\" || code === "'" || code === '"'){ return code; }
    if(code[0] === "u"){
      return String.fromCharCode(parseInt(code.slice(1), 16));
    }
    if(code[0] === "x"){
      return String.fromCharCode(parseInt(code.slice(1), 16));
    }
    return code;
  });
}

function createQuotedAtom(atomString){
  return new Atom({name:unescapeValue(atomString.slice(1, -1).replace(/''/g, "'"))});
}

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
  var content = atomString.slice(1, -1);
  return new StringAtom({name:"\"" + unescapeValue(content) + "\""});
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

function createExistentialStatement(variable, statement){
  return new ExistentialStatement({variable:variable, statement:statement, raw:variable.toString() + "^" + statement.toString()});
}

function createCutStatement(){
  return new CutStatement({raw:"!"});
}

function createAssertStatement(clause, position){
  return new AssertStatement({
    clause,
    hornClauses,
    position,
    raw:(position === "a" ? "asserta(" : (position === "z" ? "assert(" : "assert(")) + clause.toString() + ")"
  });
}

function createRetractStatement(clause){
  return new RetractStatement({pattern:clause, hornClauses, raw:"retract(" + clause.toString() + ")"});
}

function createIfThenElseStatement(condition, thenStatement, elseStatement){
  return new IfThenElseStatement({
    condition,
    thenStatement,
    elseStatement,
    raw:"(" + condition.toString() + " -> " + thenStatement.toString() + (elseStatement ? " ; " + elseStatement.toString() : "") + ")"
  });
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
  return new CallStatement({statement:arg, hornClauses, raw:arg.toString(true)});
}

function createApplyStatement(predicate, args){
  return new ApplyStatement({predicate, args, hornClauses, raw:"apply(" + predicate.toString(true) + ", " + args.toString(true) + ")"});
}

function createFunctorStatement(term, name, arity){
  return new FunctorStatement({term, name, arity, raw:"functor(" + term.toString(true) + ", " + name.toString(true) + ", " + arity.toString(true) + ")"});
}

function createFindAllStatement(template, goal, bag){
  return new FindAllStatement({template, goal, bag, hornClauses, raw:"findall(" + template.toString(true) + ", " + goal.toString() + ", " + bag.toString(true) + ")"});
}

function createBagOfStatement(template, goal, bag){
  return new BagOfStatement({template, goal, bag, hornClauses, raw:"bagof(" + template.toString(true) + ", " + goal.toString() + ", " + bag.toString(true) + ")"});
}

function createSetOfStatement(template, goal, bag){
  return new SetOfStatement({template, goal, bag, hornClauses, raw:"setof(" + template.toString(true) + ", " + goal.toString() + ", " + bag.toString(true) + ")"});
}

function createForallStatement(condition, action){
  return new ForallStatement({condition, action, hornClauses, raw:"forall(" + condition.toString() + ", " + action.toString() + ")"});
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
  createQuotedAtom,createAndStatements,createGreaterThanEqualStatement,createLessThanStatement,createLessThanEqualStatement,createGreaterThanStatement,createCallStatement,createApplyStatement,createFunctorStatement,createFindAllStatement,createBagOfStatement,createSetOfStatement,createForallStatement,createOnceStatement,createCutStatement,createExistentialStatement,createIfThenElseStatement,createAssertStatement,createRetractStatement,createAtom, createVariable, createPredicate, createList, SystemCalls:SystemCalls};
}

module.exports = createContext;
