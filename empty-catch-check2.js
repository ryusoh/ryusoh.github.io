import { ESLint } from "eslint";

async function main() {
  const eslint = new ESLint({
    overrideConfig: [
      {
        files: ["js/**/*.js"],
        rules: {
          "no-empty": ["error", { "allowEmptyCatch": false }]
        }
      }
    ]
  });

  const results = await eslint.lintFiles(["js"]);

  let errorsFound = false;
  for (const result of results) {
    for (const message of result.messages) {
      if (['no-empty'].includes(message.ruleId)) {
         console.log(`${result.filePath}:${message.line}:${message.column} - ${message.ruleId}: ${message.message}`);
         errorsFound = true;
      }
    }
  }

  if(!errorsFound) console.log("No empty catch errors found");
}

main().catch(console.error);
