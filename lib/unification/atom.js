
class Atom{
  constructor({name}){
    this.name = name;
  }

  equals(atom){
    return this.name === atom.name;
  }

  toString(){
    if(this.name){
      return this.name.toLowerCase();
    }
    return "";
  }
}

module.exports = Atom;
