pipeline {
  agent { label 'linux-docker-aws' }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  parameters {
    booleanParam(name: 'DEPLOY', defaultValue: false, description: 'Deploy to AWS after validation')
    choice(name: 'PRICE_CLASS', choices: ['PriceClass_100', 'PriceClass_200', 'PriceClass_All'], description: 'CloudFront price class')
    string(name: 'AWS_CREDENTIALS_ID', defaultValue: 'hfa-aws-deployer', description: 'Jenkins AWS credentials ID; use short-lived credentials or workload identity')
  }

  environment {
    AWS_STACK = 'hfa-silverstrong'
    AWS_REGION = "${env.AWS_REGION ?: 'us-east-1'}"
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Install dependencies') {
      steps {
        sh 'node --version'
        sh 'npm --version'
        sh 'npm ci'
      }
    }

    stage('Test') {
      steps { sh 'npm test -- --runInBand' }
    }

    stage('Validate JavaScript') {
      steps {
        sh '''node - <<'NODE'
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('index.html', 'utf8');
const match = source.match(/<script>([\\s\\S]*)<\\/script>/);
if (!match) throw new Error('Inline application script was not found');
new vm.Script(match[1]);
console.log('Inline JavaScript parsed successfully');
NODE'''
      }
    }

    stage('Build container') {
      steps {
        sh 'docker build --pull --tag hfa-silverstrong:${BUILD_NUMBER} .'
      }
    }

    stage('Container scan') {
      steps {
        sh '''if command -v trivy >/dev/null 2>&1; then
  trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed hfa-silverstrong:${BUILD_NUMBER}
else
  echo "Trivy is not installed on this Jenkins agent; install it to enable image scanning."
fi'''
      }
    }

    stage('Deploy AWS static site') {
      when { expression { params.DEPLOY } }
      steps {
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: params.AWS_CREDENTIALS_ID]]) {
          sh '''set -eu
aws sts get-caller-identity
aws cloudformation deploy \
  --region "$AWS_REGION" \
  --stack-name "$AWS_STACK" \
  --template-file infra/cloudformation.yml \
  --parameter-overrides AppName="$AWS_STACK" PriceClass="$PRICE_CLASS"
BUCKET=$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$AWS_STACK" --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
DISTRIBUTION=$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$AWS_STACK" --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)
aws s3 sync . "s3://$BUCKET/" --delete --exclude '.git/*' --exclude 'node_modules/*' --exclude 'Jenkinsfile' --exclude 'infra/*' --exclude 'docker-compose.yml' --exclude 'k8s-deployment.yaml'
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths '/*'
aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$AWS_STACK" --query "Stacks[0].Outputs[?OutputKey=='SiteUrl'].OutputValue" --output text'''
  }
      }
    }
  }

  post {
    always { archiveArtifacts artifacts: 'index.html,infra/cloudformation.yml', fingerprint: true }
  }
}
