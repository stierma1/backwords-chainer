
class Variable{
  constructor({name}){
    this.name = name;
  }

  equals(variable){
    return this.name === variable.name;
  }

  toString(reducateToUnderScore){
    if(reducateToUnderScore && this.name[0] === "_"){
      return "_"
    }
    return this.name;
  }
}

module.exports = Variable;
