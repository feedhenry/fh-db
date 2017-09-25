#!groovy

// https://github.com/feedhenry/fh-pipeline-library
@Library('fh-pipeline-library') _

fhBuildNode {
    stage('Install Dependencies') {
        npmInstall {}
    }

    stage('Unit tests') {
        withOpenshiftServices(['mongodb32']) {
            sh 'grunt fh-unit'
        }
    }

    stage('Build') {
        gruntBuild {
            name = 'fh-db'
        }
    }
}
