import { execSync } from 'child_process';
import { readFile } from 'fs/promises';

async function buildDocker() {
  // Read the package.json file
  const packageJson = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf-8'));

  // Extract the version and define image details
  const version = packageJson.version;
  const imageName = 'andrewshell/ytopml';
  const platforms = 'linux/amd64,linux/arm64';

  console.log(`Building and pushing Docker image: ${imageName}:${version}`);

  // Construct the Docker command
  const command = `docker buildx build --platform ${platforms} -t ${imageName}:${version} -t ${imageName}:latest --push .`;

  // Execute the Docker build command
  execSync(command, { stdio: 'inherit' });

  return 'Docker image built and pushed successfully.';
}

buildDocker()
  .then((message) => console.log(message))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });