/* description: Parses and executes mathematical expressions. */

/* lexical grammar */
%lex
%%
\s+                 return "WHITE_SPACE"
">("                    return "GREATER_THAN"
">=("                   return "GREATER_THAN_EQUAL"
"<("                    return "LESS_THAN"
"<=("                   return "LESS_THAN_EQUAL"
"=("                 return "UNIFY"
"not("               return 'NOT'
"\\+"                return "NOT_ALIAS"
"once("               return "ONCE"
"call("               return "CALL"
"apply("              return "APPLY"
"functor("          return "FUNCTOR"
"ifThenElse("          return "IF_THEN_ELSE"
"asserta("             return "ASSERTA"
"assertz("             return "ASSERTZ"
"assert("              return "ASSERT"
"retract("             return "RETRACT"
"findall("             return "FINDALL"
"bagof("               return "BAGOF"
"setof("               return "SETOF"
"forall("              return "FORALL"
"+("                   return "ADD"
"*("                    return "MULTI"
"systemCall("             return "SYSTEM_CALL"
[A-Z][_A-Za-z0-9]*              return 'VARIABLE'
[a-z][_A-Za-z0-9]*               return 'ATOM'
\-?[0-9]+(\.[0-9]+)?               return 'NUMBER'
[\"]                  return "DOUBLE_QUOTE"
[\\]                  return "ESCAPE_CHAR"
","                   return ','
"/"                   return '/'
";"                   return ';'
"."                   return 'END'
"("                   return '('
")"                   return ')'
":-"                  return ':-'
"!"                   return '!'
"|"                   return "|"
"["                   return "["
"]"                   return "]"
"_"                   return "_"
\{[0-9A-Za-z_\-]+\}           return "OBJECT_ATOM"
<<EOF>>               return 'EOF'
.                     return 'INVALID'

/lex
%left ',' ';' ')'
%left UNION
/* operator associations and precedence */

%start expressions

%% /* language grammar */

expressions
    : goal EOF {
      return $1;
    }
    ;

goal
  : statements -> $1
  ;

nonQuoteToken
  : WHITE_SPACE
  | GREATER_THAN
  | GREATER_THAN_EQUAL
  | LESS_THAN
  | LESS_THAN_EQUAL
  | UNIFY
  | NOT
  | NOT_ALIAS
  | IF_THEN_ELSE
  | RETRACT
  | ASSERT
  | ASSERTZ
  | ASSERTA
  | "/"
  | ONCE
  | CALL
  | APPLY
  | FUNCTOR
  | FINDALL
  | BAGOF
  | SETOF
  | FORALL
  | ADD
  | MULTI
  | SYSTEM_CALL
  | VARIABLE
  | ATOM
  | OBJECT_ATOM
  | NUMBER
  | ","
  | ";"
  | END
  | "("
  | ")"
  | ":-"
  | "!"
  | "|"
  | "["
  | "]"
  | "_"
  | INVALID
  ;

fullyEscaped
  : ESCAPE_CHAR DOUBLE_QUOTE -> $1 + $2
  | ESCAGE_CHAR nonQuoteToken -> $1 + $2
  | ESCAPE_CHAR ESCAPE_CHAR -> $1 + $2
  ;

stringContent
  : /**/ -> ""
  | stringContent fullyEscaped -> $1 + $2
  | stringContent nonQuoteToken -> $1 + $2
  ;

string
  : DOUBLE_QUOTE stringContent DOUBLE_QUOTE -> $1 + $2 + $3
  ;

opt_white
    : /**/ -> ""
    | WHITE_SPACE
    ;

clauses
  : opt_white fact -> [$2]
  | opt_white hornClause -> [$2]
  | clauses opt_white fact {
    $1.push($3);
    $$ = $1;
  }
  | clauses opt_white hornClause {
    $1.push($3);
    $$ = $1;
  }
  ;

fact
  : predicate END {
    $$ = yy.createHornClause($1);
  }
  | ATOM END {
    $$ = yy.createHornClause(yy.createPredicate({name:$1, argsList:[]}));
  }
  ;

hornClause
  : predicate opt_white body {
    $$ = yy.createHornClause($1, $3);
  }
  | ATOM opt_white body {
    $$ = yy.createHornClause(yy.createPredicate({name:$1, argsList:[]}), $3);
  }
  ;

body
  : ":-" statements END {
    $$ = yy.createAndStatements($2);
  }
  ;

statements
  : statement opt_white {
    $$ = yy.createAndStatements($1);
  }
  | statements ";" statement opt_white {
    $$ = yy.createOrStatements($1, $3);
  }
  | statements "," statement opt_white {
    $$ = yy.createAndStatements($1, $3);
  }
  ;

statement
  : simpleStatement %prec ';' {
    $$ = $1;
  }
  | ifThenElseStatement -> $1
  | assertStatement -> $1
  | retractStatement -> $1
  | opt_white "(" statements ")" {
    $$ = $3;
  }
  ;

simpleStatement
  : opt_white predicate {
    $$ = yy.createPredicateStatement($2)
  }
  | opt_white ATOM {
    $$ = yy.createPredicateStatement(yy.createPredicate({name:$2, argsList:[]}));
  }
  | opt_white "!" {
    $$ = yy.createCutStatement();
  }
  | unionStatement -> $1
  | notStatement -> $1
  | onceStatement -> $1
  | applyStatement -> $1
  | callStatement -> $1
  | functorStatement -> $1
  | findallStatement -> $1
  | bagofStatement -> $1
  | setofStatement -> $1
  | forallStatement -> $1
  | systemCallStatement -> $1
  | addStatement -> $1
  | multiStatement -> $1
  | greaterThanStatement -> $1
  | greaterThanEqualStatement -> $1
  | lessThanStatement -> $1
  | lessThanEqualStatement -> $1
  ;

systemCallStatement
  : opt_white SYSTEM_CALL opt_white atomOrVariableOrPredicateOrList opt_white ")" {
    $$ = yy.SystemCalls($4);
  }
  ;

findallStatement
  : opt_white FINDALL opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white statement opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
    $$ = yy.createFindAllStatement($4, $8, $12);
  }
  ;

bagofStatement
  : opt_white BAGOF opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white statement opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
    $$ = yy.createBagOfStatement($4, $8, $12);
  }
  ;

setofStatement
  : opt_white SETOF opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white statement opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
    $$ = yy.createSetOfStatement($4, $8, $12);
  }
  ;

forallStatement
  : opt_white FORALL opt_white statement opt_white "," opt_white statement opt_white ")" {
    $$ = yy.createForallStatement($4, $8);
  }
  ;

lessThanStatement
    : opt_white LESS_THAN opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
      $$ = yy.createLessThanStatement($4, $8);
    }
    ;

lessThanEqualStatement
      : opt_white LESS_THAN_EQUAL opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
        $$ = yy.createLessThanEqualStatement($4, $8);
      }
      ;

greaterThanStatement
  : opt_white GREATER_THAN opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
    $$ = yy.createGreaterThanStatement($4, $8);
  }
  ;

greaterThanEqualStatement
    : opt_white GREATER_THAN_EQUAL opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
      $$ = yy.createGreaterThanEqualStatement($4, $8);
    }
    ;

addStatement
  : opt_white ADD opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
    $$ = yy.addStatement($4, $8, $12);
  }
  ;

multiStatement
  : opt_white MULTI opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
    $$ = yy.createMultiStatement($4, $8, $12);
  }
  ;

predicate
  : predicateHead opt_white ")" {
    $$ = yy.createPredicate($1);
  }
  ;

predicateHead
  : atom "(" opt_white atomOrVariableOrPredicateOrList {
      $$ = {name:$1.name, argsList:[$4]}
  }
  | predicateHead opt_white "," opt_white atomOrVariableOrPredicateOrList {
    $1.argsList.push($5);
    $$ = $1;
  }
  ;

ifThenElseStatement
  : opt_white IF_THEN_ELSE opt_white statement opt_white "," opt_white statement opt_white "," opt_white statement opt_white ")" {
    $$ = yy.createIfThenElseStatement($4, $8, $12);
  }
  ;

assertStatement
  : opt_white ASSERT opt_white clauseTerm opt_white ")" {
    $$ = yy.createAssertStatement($4, "z");
  }
  | opt_white ASSERTA opt_white clauseTerm opt_white ")" {
    $$ = yy.createAssertStatement($4, "a");
  }
  | opt_white ASSERTZ opt_white clauseTerm opt_white ")" {
    $$ = yy.createAssertStatement($4, "z");
  }
  ;

retractStatement
  : opt_white RETRACT opt_white clauseTerm opt_white ")" {
    $$ = yy.createRetractStatement($4);
  }
  ;

clauseTerm
  : opt_white "(" clauseTerm ")" {
    $$ = $3;
  }
  | predicate opt_white ":-" opt_white statements {
    $$ = yy.createHornClause($1, yy.createAndStatements($5));
  }
  | predicate {
    $$ = yy.createHornClause($1);
  }
  ;

notStatement
  : opt_white NOT statements ")" {
    $$ = yy.createNotStatement($3);
  }
  | opt_white NOT_ALIAS statement {
    $$ = yy.createNotStatement($3);
  }
  ;


callStatement
  : opt_white CALL opt_white atomOrVariableOrPredicateOrList opt_white ")" {
    $$ = yy.createCallStatement($4);
  }
  ;

onceStatement
    : opt_white ONCE statements ")" {
      $$ = yy.createOnceStatement($3);
    }
    ;

functorStatement
    : opt_white FUNCTOR opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
      $$ = yy.createFunctorStatement($4, $8, $12);
    }
    ;

applyStatement
    : opt_white APPLY opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
      $$ = yy.createApplyStatement($4, $8);
    }
    ;

unionStatement
  : opt_white UNIFY opt_white atomOrVariableOrPredicateOrList opt_white "," opt_white atomOrVariableOrPredicateOrList opt_white ")" {
    $$ = yy.createUnionStatement($4, $8);
  }
  ;

variable
    : VARIABLE {
      $$ = yy.createVariable($1);
    }
    | "_" {
      $$ = yy.createFreeVariable();
    }
    ;

atom
    : ATOM {
      $$ = yy.createAtom($1);
    }
    | number -> $1
    | string {
      $$ = yy.createString($1)
    }
    | OBJECT_ATOM {
      var objAtomKey = $1.replace("{","").replace("}","");
      $$ = yy.createObjectAtom(objAtomKey);
    }
    ;

number
    : NUMBER {
      $$ = yy.createNumber($1);
    }
    ;

atomOrVariableOrPredicateOrList
    : atomOrVariableOrPredicate -> $1
    | list - $1
    | nameArityTerm -> $1
    ;

nameArityTerm
    : atom "/" atomOrVariable -> yy.createPredicate({name:"/", argsList:[$1, $3]})
    ;

atomOrVariableOrPredicate
    : atomOrVariable -> $1
    | predicate -> $1
    ;

atomOrVariable
    : atom -> $1
    | variable -> $1
    ;

atomOrVariableOrList
    : atomOrVariable -> $1
    | list -> $1
    ;

list
    : listHeadNonEmpty "|" opt_white atomOrVariableOrList opt_white "]" {
      $$ = yy.createList($1, $4);
    }
    | listHead "]" {
      $$ = yy.createList($1);
    }
    ;

listHeadNonEmpty
    : "[" opt_white atomOrVariableOrPredicateOrList opt_white -> [$3]
    | listHead "," opt_white atomOrVariableOrPredicateOrList opt_white {
      $1.push($4);
      $$ = $1;
    }
    ;

listHead
    : "[" opt_white -> []
    | listHeadNonEmpty -> $1
    ;
