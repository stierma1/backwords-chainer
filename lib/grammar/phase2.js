function skipString(source, index){
  var escaped = false;
  index++;
  while(index < source.length){
    if(escaped){
      escaped = false;
    } else if(source[index] === "\\"){
      escaped = true;
    } else if(source[index] === "\""){
      return index + 1;
    }
    index++;
  }
  return index;
}

function findMatchingParen(source, start){
  var depth = 0;
  var i = start;
  while(i < source.length){
    if(source[i] === "\""){
      i = skipString(source, i);
      continue;
    }
    if(source[i] === "("){
      depth++;
    } else if(source[i] === ")"){
      depth--;
      if(depth === 0){
        return i;
      }
    }
    i++;
  }
  return -1;
}

function rewriteParentheses(source){
  var result = "";
  var i = 0;

  while(i < source.length){
    if(source[i] === "\""){
      var start = i;
      i = skipString(source, i);
      result += source.slice(start, i);
      continue;
    }

    if(source[i] === "("){
      var close = findMatchingParen(source, i);
      if(close === -1){
        result += source.slice(i);
        break;
      }
      result += "(" + rewriteSource(source.slice(i + 1, close)) + ")";
      i = close + 1;
      continue;
    }

    result += source[i];
    i++;
  }

  return result;
}

function isWordChar(ch){
  return /[A-Za-z0-9_]/.test(ch);
}

function findTopLevelWord(source, word){
  var depth = 0;
  var i = 0;

  while(i < source.length){
    if(source[i] === "\""){
      i = skipString(source, i);
      continue;
    }

    var ch = source[i];
    if(ch === "(" || ch === "[" || ch === "{"){
      depth++;
    } else if(ch === ")" || ch === "]" || ch === "}"){
      depth--;
    } else if(depth === 0 && source.slice(i, i + word.length) === word){
      var before = i === 0 ? "" : source[i - 1];
      var after = source[i + word.length] || "";
      if(!isWordChar(before) && !isWordChar(after)){
        return i;
      }
    }
    i++;
  }

  return -1;
}

function findTopLevelComparison(source){
  var depth = 0;
  var i = 0;

  while(i < source.length){
    if(source[i] === "\""){
      i = skipString(source, i);
      continue;
    }

    var ch = source[i];
    if(ch === "(" || ch === "[" || ch === "{"){
      depth++;
      i++;
      continue;
    }
    if(ch === ")" || ch === "]" || ch === "}"){
      depth--;
      i++;
      continue;
    }

    if(depth === 0){
      var rest = source.slice(i);
      var operators = ["=:=", "=\\=", "=<", ">=", ">", "<"];

      for(var j = 0; j < operators.length; j++){
        var op = operators[j];
        if(rest.slice(0, op.length) === op){
          var before = source.slice(0, i).trim();
          var after = source.slice(i + op.length).trim();
          if(!before || !after){
            break;
          }
          if((op === ">" || op === "<") && after[0] === "("){
            break;
          }
          if(op === "=<" && after[0] === "("){
            break;
          }
          return {index:i, operator:op, left:before, right:after};
        }
      }
    }
    i++;
  }

  return null;
}

function findTopLevelNotUnifiable(source){
  var depth = 0;
  var i = 0;

  while(i < source.length){
    if(source[i] === "\""){
      i = skipString(source, i);
      continue;
    }
    var ch = source[i];
    if(ch === "(" || ch === "[" || ch === "{"){
      depth++;
    } else if(ch === ")" || ch === "]" || ch === "}"){
      depth--;
    } else if(depth === 0 && ch === "\\" && source[i + 1] === "="){
      return {
        index:i,
        left:source.slice(0, i).trim(),
        right:source.slice(i + 2).trim()
      };
    }
    i++;
  }

  return null;
}

function findTopLevelEquality(source){
  var depth = 0;
  var i = 0;

  while(i < source.length){
    if(source[i] === "\""){
      i = skipString(source, i);
      continue;
    }
    var ch = source[i];
    if(ch === "(" || ch === "[" || ch === "{"){
      depth++;
    } else if(ch === ")" || ch === "]" || ch === "}"){
      depth--;
    } else if(depth === 0 && ch === "="){
      var rest = source.slice(i);
      if(rest.slice(0, 3) === "=:=" || rest.slice(0, 3) === "=\\=" || rest.slice(0, 2) === "=<" || rest.slice(0, 2) === "=("){
        i++;
        continue;
      }
      var left = source.slice(0, i).trim();
      var right = source.slice(i + 1).trim();
      if(left && right){
        return {index:i, left:left, right:right};
      }
    }
    i++;
  }

  return null;
}

function splitTopLevel(source){
  var parts = [];
  var start = 0;
  var depth = 0;
  var i = 0;

  while(i < source.length){
    if(source[i] === "\""){
      i = skipString(source, i);
      continue;
    }

    var ch = source[i];
    if(ch === "(" || ch === "[" || ch === "{"){
      depth++;
      i++;
      continue;
    }
    if(ch === ")" || ch === "]" || ch === "}"){
      depth--;
      i++;
      continue;
    }

    if(depth === 0){
      var delimiter = null;
      if(source.slice(i, i + 2) === ":-"){
        delimiter = ":-";
      } else if(ch === "," || ch === ";" || ch === "."){
        if(ch === "." && i > 0 && /[0-9]/.test(source[i - 1]) && /[0-9]/.test(source[i + 1] || "")){
          i++;
          continue;
        }
        delimiter = ch;
      }

      if(delimiter){
        parts.push({text:source.slice(start, i), delimiter:delimiter});
        i += delimiter.length;
        start = i;
        continue;
      }
    }

    i++;
  }

  parts.push({text:source.slice(start), delimiter:""});
  return parts;
}

function tokenizeExpression(source){
  var tokens = [];
  var i = 0;

  while(i < source.length){
    var ch = source[i];
    if(/\s/.test(ch)){
      i++;
      continue;
    }

    if(/[0-9]/.test(ch)){
      var start = i;
      while(i < source.length && /[0-9]/.test(source[i])){
        i++;
      }
      if(source[i] === "." && /[0-9]/.test(source[i + 1] || "")){
        i++;
        while(i < source.length && /[0-9]/.test(source[i])){
          i++;
        }
      }
      tokens.push({type:"number", value:source.slice(start, i)});
      continue;
    }

    if(/[A-Z_]/.test(ch)){
      var start = i;
      while(i < source.length && /[A-Za-z0-9_]/.test(source[i])){
        i++;
      }
      tokens.push({type:"variable", value:source.slice(start, i)});
      continue;
    }

    if(source.slice(i, i + 2) === "**"){
      tokens.push({type:"op", value:"**"});
      i += 2;
      continue;
    }
    if(source.slice(i, i + 2) === "//"){
      tokens.push({type:"op", value:"//"});
      i += 2;
      continue;
    }
    if(source.slice(i, i + 3) === "mod" && !isWordChar(source[i + 3] || "")){
      tokens.push({type:"op", value:"mod"});
      i += 3;
      continue;
    }
    if("+-*/".indexOf(ch) !== -1){
      tokens.push({type:"op", value:ch});
      i++;
      continue;
    }
    if(ch === "(" || ch === ")"){
      tokens.push({type:"punct", value:ch});
      i++;
      continue;
    }

    return null;
  }

  return tokens;
}

function parseExpression(source){
  var tokens = tokenizeExpression(source);
  if(!tokens){
    return null;
  }

  var index = 0;
  var precedence = {"+":10, "-":10, "*":20, "/":20, "//":20, "mod":20, "**":30};

  function parsePrimary(){
    var token = tokens[index];
    if(!token){
      return null;
    }
    if(token.type === "number"){
      index++;
      return token.value;
    }
    if(token.type === "variable"){
      index++;
      return token.value;
    }
    if(token.type === "punct" && token.value === "("){
      index++;
      var inner = parseBinary(0);
      if(inner === null || !tokens[index] || tokens[index].value !== ")"){
        return null;
      }
      index++;
      return inner;
    }
    return null;
  }

  function parseUnary(){
    var token = tokens[index];
    if(token && token.type === "op" && token.value === "-"){
      index++;
      var operand = parseUnary();
      if(operand === null){
        return null;
      }
      return "expr(neg, " + operand + ")";
    }
    return parsePrimary();
  }

  function parseBinary(minPrecedence){
    var left = parseUnary();
    if(left === null){
      return null;
    }

    while(true){
      var token = tokens[index];
      if(!token || token.type !== "op" || precedence[token.value] === undefined){
        break;
      }
      var prec = precedence[token.value];
      if(prec < minPrecedence){
        break;
      }

      index++;
      var nextMin = token.value === "**" ? prec : prec + 1;
      var right = parseBinary(nextMin);
      if(right === null){
        return null;
      }

      var names = {"+":"add", "-":"sub", "*":"mul", "/":"div", "//":"idiv", "mod":"mod", "**":"pow"};
      left = "expr(" + names[token.value] + ", " + left + ", " + right + ")";
    }

    return left;
  }

  var result = parseBinary(0);
  if(result === null || index !== tokens.length){
    return null;
  }
  return result;
}

function rewriteSegment(segment){
  var trimmed = segment.trim();
  if(!trimmed){
    return segment;
  }

  var leading = segment.slice(0, segment.indexOf(trimmed));
  var trailing = segment.slice(segment.indexOf(trimmed) + trimmed.length);

  var isIndex = findTopLevelWord(trimmed, "is");
  if(isIndex > 0){
    var target = trimmed.slice(0, isIndex).trim();
    var expression = trimmed.slice(isIndex + 2).trim();
    var parsed = parseExpression(expression);
    if(parsed !== null){
      return leading + "is(" + target + ", " + parsed + ")" + trailing;
    }
  }

  var comparison = findTopLevelComparison(trimmed);
  if(comparison){
    var left = parseExpression(comparison.left);
    var right = parseExpression(comparison.right);
    if(left !== null && right !== null){
      var names = {"=:=":"eq", "=\\=":"neq", "=<":"le", ">=":"ge", "<":"lt", ">":"gt"};
      return leading + "arithCompare(" + names[comparison.operator] + ", " + left + ", " + right + ")" + trailing;
    }
  }

  var notUnifiable = findTopLevelNotUnifiable(trimmed);
  if(notUnifiable && notUnifiable.left && notUnifiable.right){
    return leading + "notUnifiable(" + notUnifiable.left + ", " + notUnifiable.right + ")" + trailing;
  }

  var equality = findTopLevelEquality(trimmed);
  if(equality){
    return leading + "=(" + equality.left + ", " + equality.right + ")" + trailing;
  }

  return segment;
}

function rewriteTopLevel(source){
  var parts = splitTopLevel(source);
  var result = "";

  for(var i = 0; i < parts.length; i++){
    result += rewriteSegment(parts[i].text) + parts[i].delimiter;
  }

  return result;
}

function rewriteSource(source){
  return rewriteTopLevel(rewriteParentheses(source));
}

function rewritePhase2(source){
  return rewriteSource(source);
}

module.exports = rewritePhase2;
module.exports.splitTopLevel = splitTopLevel;
