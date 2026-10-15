import { readConfig, deploymentErrors } from "./deploy-config.js";
try {
  const errors = deploymentErrors(readConfig());
  if (errors.length) {
    console.error("배포 준비 필요: " + errors.join(" ") + " README 참고.");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
