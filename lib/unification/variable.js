
class Variable{
  constructor({name}){
    this.name = name;
  }

  equals(variable){
    return variable instanceof Variable && this.name === variable.name;
  }

  toString(reduceToUnderScore){
    if(reduceToUnderScore && this.name[0] === "_"){
      return "_"
    }
    return this.name;
  }
}

module.exports = Variable;
