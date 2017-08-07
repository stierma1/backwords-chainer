
class Atom{
  constructor({name}){
    this.name = name;
  }

  equals(atom){
    return this.name === atom.name;
  }

  toString(){
    return this.name.toLowerCase();
  }
}

module.exports = Atom;
