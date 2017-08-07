
var {unify, andUnify, SubstitutionSet} = require("./unification");
var {generateRuntimeVariable} = require("./utils");
var Variable = require("./variable");
var Predicate = require("./predicate");
var Atom = require("./atom");
var trs = require("./trs");

var runtimeVariableIdx = 0;
class AndStatements{
  constructor({subStatements}){
    this.subStatements = subStatements || [];
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
  constructor({subStatements}){
    this.subStatements = subStatements || [];
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
  constructor({subject, object}){
    this.subject = subject;
    this.object = object;
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
  constructor({subStatement}){
    this.subStatement = subStatement;
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

class PredicateStatement {
  constructor({predicate, hornClauses}){
    this.predicate = predicate;
    this.hornClauses = hornClauses;
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
    trs(substitutionSet);
    var orStatements = hornInstances.map((hornInstance) => {
      //console.log(this.toString(), substitutionSet);
      var andStatements = [new UnionStatement({subject:this.predicate.deepCopyWithReplace(substitutionSet), object:hornInstance.head})];
      if(hornInstance.body){
        andStatements = andStatements.concat(hornInstance.body.subStatements);
      }

      return new AndStatements({subStatements:andStatements});
    })

    //console.log("Invoking predicate yielded: " + (new OrStatements({subStatements:orStatements})).toString(),"\n", substitutionSet.toString())
    yield* (new OrStatements({subStatements:orStatements})).unify(substitutionSet)
  }

  toString(){
    return this.predicate.toString();
  }
}

class HornClause{
  constructor({head, body}){
    this.head = head;
    this.body = body;
  }

  getRuntimeInstance(){
    var subSet = new SubstitutionSet({});
    this.head.getRuntimeSubstitution(subSet);
    this.body.getRuntimeSubstitution(subSet);
    var newHead = this.head.getRuntimeInstance(subSet);
    var newBody = this.body.getRuntimeInstance(subSet);

    return new HornClause({head:newHead, body:newBody});
  }

  toString(){
    return this.head.toString() + " :- " + this.body.toString() + "."
  }
}


module.exports  = {
  AndStatements:AndStatements,
  OrStatements: OrStatements,
  UnionStatement: UnionStatement,
  HornClause: HornClause,
  PredicateStatement: PredicateStatement,
  NotStatement: NotStatement
}
