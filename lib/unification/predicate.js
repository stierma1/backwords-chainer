
var Variable = require("./variable");
var {generateRuntimeVariable} = require("./utils");

class Predicate{
  constructor({name, argsList}){
    this.name = name;
    this.arity = argsList.length;
    this.argsList = argsList;
  }

  deepSearch(variable){
    var argsList = this.argsList;
    for(var i in argsList){
      if(argsList[i] instanceof Variable){
        if(argsList[i].equals(variable)){
          return true;
        }
      } else if(argsList[i] instanceof Predicate){
        var ret = argsList[i].deepSearch(variable);
        if(ret){
          return ret;
        }
      }
    }

    return false;
  }

  deepCopy(){
    var newArgsList = this.argsList.map((arg) => {
      if(arg instanceof Predicate){
        return arg.deepCopy();
      }
      return arg;
    });

    return new Predicate({name:this.name, argsList:newArgsList});
  }

  deepCopyWithReplace(substitutionSet){
    var newPred = this.deepCopy();
    return newPred._deepReplace(substitutionSet);
  }

  _deepReplace(substitutionSet){
    var argsList = this.argsList;
    var newArgsList = argsList.map((arg) => {
      if(arg instanceof Variable && substitutionSet.get(arg)){
        var varReplace = substitutionSet.get(arg);
        if(!(varReplace instanceof Variable)){
          return varReplace;
        } else if(arg.name > varReplace){
          return varReplace
        }
        return arg;
      } else if(arg instanceof Predicate){
        return arg._deepReplace(substitutionSet);
      }
      return arg;
    });
    this.argsList = newArgsList;
    return this;
  }

  getRuntimeSubstitution(substitutionSet){
    for(var i = 0; i < this.argsList.length; i++){
      if(this.argsList[i] instanceof Variable){
        if(!substitutionSet.get(this.argsList[i])){
          substitutionSet.add(this.argsList[i], generateRuntimeVariable());
        }
      } else if(this.argsList[i] instanceof Predicate){
        this.argsList[i].getRuntimeSubstitution(substitutionSet);
      }
    }
  }

  getRuntimeInstance(substitutionSet){
    var newArgsList = this.argsList.map((arg) => {
      if(arg instanceof Variable){
        return substitutionSet.get(arg);
      } else if(arg instanceof Predicate){
        return arg.getRuntimeInstance(substitutionSet);
      } else {
        return arg;
      }
    })

    return new Predicate({name:this.name, argsList:newArgsList});
  }

  toString(reducateToUnderScore){

    if(this.name === "_list"){
      return "[" + this.argsList.map((a) => {return a.toString(reducateToUnderScore)}).join(" | ") + "]"
    }
    return this.name + "(" + this.argsList.map((a) => {return a.toString(reducateToUnderScore)}).join(", ") +")";
  }

  equals(otherPredicate){
    if(otherPredicate instanceof Predicate){
      if(otherPredicate.name === this.name && otherPredicate.arity === this.arity){
        for(var i in this.argsList){
          if(!this.argsList[i].equals(otherPredicate.argsList[i])){
            return false;
          }
        }
        return true;
      }
      return false;
    }
    return false;
  }
}

module.exports = Predicate;
