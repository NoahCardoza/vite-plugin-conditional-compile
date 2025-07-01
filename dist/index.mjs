import { defineDirective, simpleMatchToken, resolveConditional, Context } from 'unplugin-preprocessor-directives';
import remapping from '@ampproject/remapping';

const vIfDirective = defineDirective((context) => {
  return {
    lex(comment) {
      return simpleMatchToken(comment ?? "", /#v-(ifdef|else|elif|endif)\s?(.*)/);
    },
    parse(token) {
      if (token.type === "ifdef" || token.type === "elif" || token.type === "else") {
        const node = {
          type: "IfStatement",
          test: token.value,
          consequent: [],
          alternate: [],
          kind: token.type,
          start: token.start,
          end: token.end
        };
        this.current++;
        while (this.current < this.tokens.length) {
          const nextToken = this.tokens[this.current];
          if (nextToken.type === "elif" || nextToken.type === "else") {
            node.alternate.push(this.walk());
            node.end = Math.max(node.end || Number.NEGATIVE_INFINITY, ...node.alternate.map((n) => n.end || Number.NEGATIVE_INFINITY));
            break;
          } else if (nextToken.type === "endif") {
            node.end = nextToken.end;
            this.current++;
            break;
          } else {
            node.consequent.push(this.walk());
            node.end = Math.max(node.end || Number.NEGATIVE_INFINITY, ...node.consequent.map((n) => n.end || Number.NEGATIVE_INFINITY));
          }
        }
        return node;
      }
    },
    transform(node) {
      if (node.type === "IfStatement") {
        if (resolveConditional(node.test, context.env)) {
          return {
            type: "Program",
            body: node.consequent.map(this.walk.bind(this)).filter((n) => n != null),
            replace: true,
            start: node.start,
            end: node.end
          };
        } else if (node.alternate) {
          return {
            type: "Program",
            body: node.alternate.map(this.walk.bind(this)).filter((n) => n != null),
            replace: true,
            start: node.start,
            end: node.end
          };
        }
      }
    },
    generate(node, comment) {
      if (node.type === "IfStatement" && comment) {
        let code = "";
        if (node.kind === "else")
          code = `${comment.start} ${node.kind} ${comment.end}`;
        else
          code = `${comment.start} #${node.kind} ${node.test}${comment.end}`;
        const consequentCode = node.consequent.map(this.walk.bind(this)).join("\n");
        code += `
${consequentCode}`;
        if (node.alternate.length) {
          const alternateCode = node.alternate.map(this.walk.bind(this)).join("\n");
          code += `
${alternateCode}`;
        } else {
          code += `
${comment.start} #endif ${comment.end}`;
        }
        return code;
      }
    }
  };
});
const resolveOptions = (userOptions) => {
  return {
    include: ["**/*"],
    exclude: [/[\\/]node_modules[\\/]/, /[\\/]\.git[\\/]/],
    ...userOptions,
    directives: [
      // @ts-expect-error ignore
      vIfDirective
    ]
  };
};

function createContext(options = {}) {
  return new Context(resolveOptions(options));
}

const VitePluginConditionalCompile = (userOptions = {}) => {
  const ctx = createContext(userOptions);
  return {
    name: "vite-plugin-conditional-compile",
    enforce: "pre",
    configResolved(config) {
      ctx.env = { ...ctx.env, ...config.env };
    },
    transform(code, id) {
      if (ctx.filter(id)) {
        const transformed = ctx.transformWithMap(code, id);
        if (transformed) {
          const map = remapping(
            [this.getCombinedSourcemap(), transformed.map],
            () => null
          );
          return {
            code: transformed.code,
            map
          };
        }
      }
    }
  };
};

export { VitePluginConditionalCompile as default };
