function findMatchingParen(source, start){
  var depth = 0;
  var inString = false;
  var escaped = false;

  for(var i = start; i < source.length; i++){
    var ch = source[i];

    if(inString){
      if(escaped){
        escaped = false;
      } else if(ch === "\\"){
        escaped = true;
      } else if(ch === "\""){
        inString = false;
      }
      continue;
    }

    if(ch === "\""){
      inString = true;
    } else if(ch === "("){
      depth++;
    } else if(ch === ")"){
      depth--;
      if(depth === 0){
        return i;
      }
    }
  }

  return -1;
}

function findTopLevel(source, token){
  var depth = 0;
  var inString = false;
  var escaped = false;

  for(var i = 0; i < source.length; i++){
    var ch = source[i];

    if(inString){
      if(escaped){
        escaped = false;
      } else if(ch === "\\"){
        escaped = true;
      } else if(ch === "\""){
        inString = false;
      }
      continue;
    }

    if(ch === "\""){
      inString = true;
    } else if(ch === "("){
      depth++;
    } else if(ch === ")"){
      depth--;
    } else if(depth === 0 && source.slice(i, i + token.length) === token){
      return i;
    }
  }

  return -1;
}

function splitIfThenElse(source){
  var arrow = findTopLevel(source, "->");
  if(arrow === -1){
    return null;
  }

  var condition = source.slice(0, arrow);
  var afterArrow = source.slice(arrow + 2);
  var semicolon = findTopLevel(afterArrow, ";");

  if(semicolon === -1){
    return {
      condition:condition,
      thenPart:afterArrow,
      elsePart:"fail"
    };
  }

  return {
    condition:condition,
    thenPart:afterArrow.slice(0, semicolon),
    elsePart:afterArrow.slice(semicolon + 1)
  };
}

function rewriteSegment(source){
  var result = "";
  var i = 0;

  while(i < source.length){
    var ch = source[i];

    if(ch === "\""){
      var start = i;
      i++;
      var escaped = false;
      while(i < source.length){
        if(escaped){
          escaped = false;
        } else if(source[i] === "\\"){
          escaped = true;
        } else if(source[i] === "\""){
          i++;
          break;
        }
        i++;
      }
      result += source.slice(start, i);
      continue;
    }

    if(ch === "("){
      var close = findMatchingParen(source, i);
      if(close === -1){
        result += source.slice(i);
        break;
      }

      var inner = source.slice(i + 1, close);
      var rewrittenInner = rewriteSegment(inner);
      var split = splitIfThenElse(rewrittenInner);

      if(split){
        result += "ifThenElse((" + rewriteSegment(split.condition).trim() + "), (" +
          rewriteSegment(split.thenPart).trim() + "), (" +
          rewriteSegment(split.elsePart).trim() + "))";
      } else {
        result += "(" + rewrittenInner + ")";
      }

      i = close + 1;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

function rewriteIfThenElse(source){
  var rewritten = rewriteSegment(source);

  if(rewritten.indexOf(":-") === -1 && rewritten.indexOf(".") === -1){
    var split = splitIfThenElse(rewritten);
    if(split){
      return "ifThenElse((" + rewriteSegment(split.condition).trim() + "), (" +
        rewriteSegment(split.thenPart).trim() + "), (" +
        rewriteSegment(split.elsePart).trim() + "))";
    }
  }

  return rewritten;
}

module.exports = rewriteIfThenElse;
