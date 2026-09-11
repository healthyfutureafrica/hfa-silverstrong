terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# -----------------------------------------------------------------------------
# Input Variables
# -----------------------------------------------------------------------------

variable "project_id" {
  type        = string
  description = "The GCP project ID to deploy resources into."
  default     = "hfa-healthy-future-africa"
}

variable "region" {
  type        = string
  description = "The GCP region for the Cloud Run service and Artifact Registry."
  default     = "us-central1"
}

variable "service_name" {
  type        = string
  description = "The name of the Cloud Run service."
  default     = "hfa-silverstrong"
}

variable "container_image" {
  type        = string
  description = "The container image to deploy. Defaults to a placeholder until the custom image is built."
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

# -----------------------------------------------------------------------------
# 1. Enable Required GCP APIs
# -----------------------------------------------------------------------------

locals {
  services = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com"
  ]
}

resource "google_project_service" "enabled_services" {
  for_each                   = toset(local.services)
  project                    = var.project_id
  service                    = each.key
  disable_on_destroy         = false
  disable_dependent_services = false
}

# -----------------------------------------------------------------------------
# 2. Artifact Registry Repository
# -----------------------------------------------------------------------------

resource "google_artifact_registry_repository" "repo" {
  project       = var.project_id
  location      = var.region
  repository_id = var.service_name
  description   = "Docker repository for Healthy Future Africa (${var.service_name})"
  format        = "DOCKER"

  depends_on = [google_project_service.enabled_services]
}

# -----------------------------------------------------------------------------
# 3. Dedicated Service Account (Least Privilege)
# -----------------------------------------------------------------------------

resource "google_service_account" "cloud_run_sa" {
  project      = var.project_id
  account_id   = "${var.service_name}-runner"
  display_name = "Cloud Run Runtime Identity for ${var.service_name}"
}

# -----------------------------------------------------------------------------
# 4. Cloud Run (v2) Service
# -----------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "app" {
  name                = var.service_name
  location            = var.region
  project             = var.project_id
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.cloud_run_sa.email

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    containers {
      image = var.container_image

      ports {
        container_port = 80
      }

      resources {
        cpu_idle = true
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [google_project_service.enabled_services]
}

# -----------------------------------------------------------------------------
# 5. Public Access IAM Binding (Allow unauthenticated invocations)
# -----------------------------------------------------------------------------

resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project  = google_cloud_run_v2_service.app.project
  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# -----------------------------------------------------------------------------
# Outputs
# -----------------------------------------------------------------------------

output "cloud_run_url" {
  description = "The public HTTPS URL of the Cloud Run service."
  value       = google_cloud_run_v2_service.app.uri
}

output "artifact_registry_repo" {
  description = "The Artifact Registry repository URL for pushing container images."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}"
}

output "service_account_email" {
  description = "The runtime service account email for the Cloud Run instance."
  value       = google_service_account.cloud_run_sa.email
}