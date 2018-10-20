var Atom = require("./atom");
var Predicate = require("./predicate");
var List = require("./list");
var Statements = require("./statements");
var Variable = require("./variable");
var {HornClause, UnionStatement, PredicateStatement, OrStatements, AndStatements} = Statements;
//var RuntimeEngine = require("../grammar/runtime-engine")

var dummyVars = ["A", "B", "C", "D", "E", "F"].map((v) => {
  return new Variable({name:v});
})

var freeVariables = ["__A", "__B", "__C", "__D", "__E"].map((v) => {
  return new Variable({name:v});
})

//memberOf(X, Y) :- Y = [A | _], X = A ; (Y = [_ | T],  memberOf(X, T)).
function createMemberClause(){
  var varA = dummyVars[0];
  var varB = dummyVars[1];
  var tailVar = dummyVars[2];
  var memberOfHornClauses = {member:{"2":[]}};
  var memberPredicateHead = new Predicate({name:"member", argsList:[varA, varB]});
  var listMatchPredicate = new List({argsList:[varA, freeVariables[1]]});
  var listMatchUnion = new UnionStatement({subject:varB, object:listMatchPredicate});
  var listFailedMatchPredicate = new List({argsList:[freeVariables[0], tailVar]});
  var listFailedMatchUnion = new UnionStatement({subject:varB, object:listFailedMatchPredicate});
  var memberPredicateRecurse = new Predicate({name:"member", argsList:[varA, tailVar]});
  var memberPredicateRecurseStatement = new PredicateStatement({hornClauses:memberOfHornClauses, predicate:memberPredicateRecurse});
  var failedStatements = new AndStatements({subStatements:[listFailedMatchUnion,memberPredicateRecurseStatement]});
  var orStatement = new OrStatements({subStatements:[listMatchUnion, failedStatements]});
  var bodyStatement = new AndStatements({subStatements:[orStatement]});

  var memberOfHornClause = new HornClause({head:memberPredicateHead, body:bodyStatement});
  memberOfHornClauses.member[2].push(memberOfHornClause); // <-- allow for recursion

  return [memberOfHornClause];
}

//intersect(X, Y, I) :- X = [], I = [].
//intersect(X, Y, I) :- X = [A | B], memberOf(A, Y), I = [A | Res], intersect(B, Y, Res).
//intersect(X, Y, I) :- X = [_ | B], I = [_ | Res], intersect(B, Y, Res).


//subset([], []).
//subset([X|L],[X|S]) :- subset(L,S).
//subset(L, [_|S]) :- subset(L,S).
function createSubsetClause(){
  var varX = dummyVars[0];
  var varY = dummyVars[1];
  var varL = dummyVars[2];
  var varS = dummyVars[3];
  var varM = dummyVars[4];

  var freeVar = freeVariables[0];

  var horns = {"subset":{"2":[]}};
  var subsetPredicate = new Predicate({name:"subset", argsList:[varX, varY]});

  //First
  var emptyXUnion = new UnionStatement({subject: varX, object:List.getEmptyList()});
  var emptyYUnion = new UnionStatement({subject: varY, object:List.getEmptyList()});
  var andsStatements = new AndStatements({subStatements: [emptyXUnion, emptyYUnion]});
  var firstHorn = new HornClause({head:subsetPredicate, body:andsStatements});
  horns.subset[2].push(firstHorn);
  //Second
  var listMatch = new List({argsList:[varM, varL]});
  var secondMatch = new List({argsList:[varM, varS]});
  var xUnion = new UnionStatement({subject:varX, object:listMatch});
  var yUnion = new UnionStatement({subject:varY, object:secondMatch});
  var predicateRecurse = new Predicate({name:"subset", argsList:[varL, varS]});
  var predicateRecurseStatement = new PredicateStatement({predicate:predicateRecurse, hornClauses:horns});
  var secondBody = new AndStatements({subStatements:[xUnion, yUnion, predicateRecurseStatement]});
  var secondHorn = new HornClause({head:subsetPredicate, body:secondBody});
  horns.subset[2].push(secondHorn);
  //Third
  var secondMatch = new List({argsList:[freeVar, varS]});
  var yUnion = new UnionStatement({subject:varY, object:secondMatch});
  var predicateRecurse = new Predicate({name:"subset", argsList:[varX, varS]});
  var predicateRecurseStatement = new PredicateStatement({predicate:predicateRecurse, hornClauses:horns});
  var thirdBody = new AndStatements({subStatements:[yUnion, predicateRecurseStatement]});
  var thirdHorn = new HornClause({head:subsetPredicate, body:thirdBody});
  horns.subset[2].push(thirdHorn);

  return [firstHorn, secondHorn, thirdHorn];
}

//empty([]).
//notEmpty(X) :- X = [_ | B].



//commonElement([], _, []).
//commonElement(_, [], []).
//commonElement(X, Y, Z) :- memberOf(A, X), memberOf(A, Y), Z = [A].

//noCommonElement(X, Y, true) :- commonElement(X, Y, Z), isEmpty(Z, true).
//notCommonElement(X, Y, A) :- commonElement(X, Y)

//remove(_,[],[]).
//remove(A, X, Y) :- X = [A | Y].
//remove(A, X, Y) :- X = [B | Y],

//unique(X, Y)

module.exports = {createMemberClause:createMemberClause, createSubsetClause};
