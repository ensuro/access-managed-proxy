module.exports = {
  //   workingDir: process.cwd(),
  //   contractsDir: path.join(process.cwd(), "contracts"),
  //   instrumentedDir: path.join(process.cwd(), "instrumented"),
  //   client: client,
  skipFiles: ["dependencies/", "mock/"],
  mocha: {
    grep: "AccessManagedProxyS40", // Find everything with this tag
    invert: true, // Run the grep's inverse set.
  },
  //   logger: console,
};
