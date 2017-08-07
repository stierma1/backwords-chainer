
class Variable{
  constructor({name}){
    this.name = name;
  }

  equals(variable){
    return this.name === variable.name;
  }

  toString(){
    return this.name.toUpperCase();
  }
}

module.exports = Variable;
