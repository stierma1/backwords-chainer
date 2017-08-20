
class Atom{
  constructor({name}){
    this.name = name;
  }

  equals(atom){
    return atom instanceof Atom && this.name === atom.name;
  }

  toString(){
    if(this.name){
      return this.name;
    }
    return "";
  }

  getValue(){
    return this.name;
  }

  static fromValue(val){
    return new Atom({name:val});
  }
}

module.exports = Atom;
