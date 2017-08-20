
var {unify, andUnify, SubstitutionSet} = require("./unification");
var {generateRuntimeVariable} = require("./utils");
var Variable = require("./variable");
var Predicate = require("./predicate");
var Atom = require("./atom");
var NumberAtom = require("./number");
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
    return this.subject.toString() + " = " + this.object.toString();
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
    var subGen = this.subStatement.unify(substitutionSet);
    var {value,done} = subGen.next();
    if(done){
      yield substitutionSet;
    }
    while(!done){

      if(value === null){
        yield substitutionSet;
      } else {
        //yield null;
      }
      var {value,done} = subGen.next();
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
  constructor({statement, raw}){
    this.statement = statement;
    this.raw = raw;
  }

  getRuntimeSubstitution(substitutionSet){
    this.statement.getRuntimeSubstitution(substitutionSet);
  }

  getRuntimeInstance(substitutionSet){
    return new CallStatement({statement:this.statement.getRuntimeInstance(substitutionSet)})
  }

  * unify(substitutionSet){
    if(this.statement instanceof Predicate){
      var pred = new PredicateStatement({predicate:this.statement});
      yield* pred.unify(substitutionSet)
    }
  }
  toString(){
    return "call(" + this.statement.toString() + ") ";
  }
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
    var hornInstances = this.hornClauses.filter((clause) => {
      return clause.head.name === this.predicate.name && clause.head.argsList.length === this.predicate.argsList.length
    })
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

    var val = (this.functionPointer(this.callObject, substitutionSet));
    if(val instanceof (function*() {}).constructor){
      yield* val;
    } else {
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
    return this.value1.toString() + " + " + this.value2.toString() + " = " + this.result.toString();
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
    } else if(this.value1 instanceof NumberAtom && result instanceof NumberAtom ) {
      yield* new UnionStatement({subject:value2, object:new NumberAtom({name: result.toNumber() - value1.toNumber()})}).unify(substitutionSet)
    } else if(this.value2 instanceof NumberAtom && result instanceof NumberAtom ) {
      yield* new UnionStatement({subject:value2, object:new NumberAtom({name: result.toNumber() - value2.toNumber()})}).unify(substitutionSet)
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
    return this.value1.toString() + " * " + this.value2.toString() + " = " + this.result.toString();
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
    } else if(this.value1 instanceof NumberAtom && result instanceof NumberAtom ) {
      if(value1.toNumber() === 0){
        return;
      }
      yield* new UnionStatement({subject:value2, object:new NumberAtom({name: result.toNumber() / value1.toNumber()})}).unify(substitutionSet)
    } else if(this.value2 instanceof NumberAtom && result instanceof NumberAtom ) {
      if(value2.toNumber() === 0){
        return;
      }
      yield* new UnionStatement({subject:value2, object:new NumberAtom({name: result.toNumber() / value2.toNumber()})}).unify(substitutionSet)
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
    return this.value1.toString() + " > " + this.value2.toString();
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
    return this.value1.toString() + " >= " + this.value2.toString();
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
    return this.value1.toString() + " < " + this.value2.toString();
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
    return this.value1.toString() + " <= " + this.value2.toString();
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
  GreaterThanStatement: GreaterThanStatement,
  GreaterThanEqualStatement: GreaterThanEqualStatement,
  LessThanStatement: LessThanStatement,
  LessThanEqualStatement: LessThanEqualStatement,
  MultiplyStatement: MultiplyStatement
}
