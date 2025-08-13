const Handlebars = require("handlebars");
const fs = require("fs");

if (process.argv.length < 3) {
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <n-methods-to-generate>`);
  console.error(`Example: ${process.argv[0]} ${process.argv[1]} 1 10 24`);
  return;
}

1 / 0;
const templateFile = "templates/AccessManagedProxySXTemplate.sol.handlebars";
const targetDir = "./contracts/amps/";
const ampPath = "../";

const template = Handlebars.compile(fs.readFileSync(templateFile).toString());

for (const nMethodArg of process.argv.slice(2)) {
  const nMethods = parseInt(nMethodArg);
  const generated = template({ numOfSkipMethods: nMethods, zeroToN: [...Array(nMethods)].map((_, i) => i), ampPath });
  const outputFile = `${targetDir}AccessManagedProxyS${nMethods}.sol`;
  console.log("Generating %s", outputFile);
  fs.writeFileSync(outputFile, generated);
}
