// TODO: Figure out how to get a dev bootstrap to work with ts-node/esm
import tsnode from "ts-node/esm";
tsnode.then((x) => {
  require("../src/cli.ts");
});
