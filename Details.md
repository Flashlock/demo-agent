# Demo Agent - Detailed Documentation

## Overview

The Demo Agent is a reference implementation of a Pantheon agent, showcasing a complete, production-ready architecture combining a FastAPI backend service with React-based micro-frontend components. This agent demonstrates telemetry integration, human-in-the-loop (HITL) capabilities, and best practices for Pantheon agent development.

## Architecture

### Backend
- **Framework**: FastAPI service written in Python
- **Port**: Dynamically assigned by Hub Core
- **API Documentation**: OpenAPI schema available at `/docs/openapi.json`
- **Platform Support**: Windows x86_64

### Frontend
- **Type**: React-based micro-frontend (MFE)
- **Location**: `./dist_mfe` directory
- **Purpose**: Provides user interface for agent configuration and monitoring

### Deployment
- **Binary**: `./bin/demo-agent.exe` (Windows executable)
- **Execution Model**: Standalone service managed by Pantheon Hub
- **Resource Tier**: ECO (default)

## Features

### Human-In-The-Loop (HITL)
The agent supports HITL workflow integration, enabling human operators to review, approve, or modify agent decisions before execution. This is particularly useful for high-risk operations or decision validation scenarios.

### Telemetry & Monitoring
The agent implements comprehensive telemetry tracking with the following key metrics:

- **Tasks Processed (Counter)**: Total number of tasks successfully processed
- **Queue Pressure (Gauge)**: Current queue load as a percentage
- **Throughput Sparkline (24h)**: Historical throughput visualization over the last 24 hours

Telemetry is submitted to the local Hub Core API at `127.0.0.1`.

### Automated Processing
Recommended automation schedules process queue items every 10 minutes via the `/api/v1/process-queue` endpoint with configurable force-run parameters.

## Configuration

### Instance Configuration
The agent supports the following instance-level configuration:

| Field | Label | Type | Required |
|-------|-------|------|----------|
| `DEMO_GREETING` | Greeting prefix | STRING | No |

Instances can customize the greeting prefix to tailor agent responses to specific use cases.

## Capabilities & Permissions

### Network Capabilities
- **Outbound**: Permitted to connect to `127.0.0.1` for submitting telemetry and HITL callbacks to Hub Core API
- **Bind**: Allowed to bind to the Hub-assigned port for exposing the HTTP service

### Required Justifications
- Telemetry and HITL calls require outbound network access to the local Hub Core API
- HTTP service exposure requires port binding permissions

## Branding

The agent features a cohesive green-themed design:

- **Primary Color**: `#00E676` (Bright Green)
- **Secondary Color**: `#69F0AE` (Light Green)
- **Surface Color**: `#0B1F14` (Dark Green)
- **Accent Color**: `#00E676`
- **Gradient**: 135° angle from `#00E676` to `#004D40`
- **Icon**: Located at `./assets/icon.svg`

## Billing Model

The Demo Agent uses a hybrid billing approach combining base subscription and usage-based fees:

### Base Subscription
- **Model**: Monthly subscription
- **Cost**: $10 USD/month

### Usage-Based Metrics

| Metric | Unit | Price | Description |
|--------|------|-------|-------------|
| `report.generated` | Report | $0.10 | Each completed report exported from the agent |
| `query.executed` | Query | $0.01 | Each API query or search request processed |
| `video.minute` | Minute | $0.50 | Each minute of generated or processed video output |

## Version Information

- **Package Name**: Demo Agent
- **Agent ID**: `io.pantheon.demo_agent`
- **Current Version**: 1.0.3
- **Minimum Pantheon Version**: 0.1.0
- **Manifest Schema Version**: 1

## Development Information

**Developer**: Project Pantheon  
**Support URL**: https://github.com/example/project-pantheon

## Use Cases

The Demo Agent is ideal for:
- Reference implementation for Pantheon agent architecture
- Development and testing of agent capabilities
- Demonstration of FastAPI integration with Pantheon
- Showcasing telemetry and HITL workflow patterns
- Learning best practices for multi-language agent development (TypeScript, Python, PowerShell)

## Technical Stack

- **Primary Languages**: TypeScript (45%), Python (44.5%), PowerShell (9.2%)
- **Web Framework**: FastAPI (Python)
- **Frontend Framework**: React
- **API Standard**: OpenAPI 3.0
