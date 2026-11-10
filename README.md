# Interactive Stories

Type a theme and a language model writes a complete choose-your-own-adventure story for it: a branching tree of scenes, choices, and winning and losing endings. You then play through it in the browser, one decision at a time.

The app has two parts. A **FastAPI** backend generates stories with **LangChain** against any OpenAI-compatible model endpoint (by default, a local [LM Studio](https://lmstudio.ai/) server) and stores them with **SQLAlchemy**. A **React + Vite** frontend is where you create and play them.

## Contents

- [Interactive Stories](#interactive-stories)
  - [Contents](#contents)
  - [Features](#features)
  - [How it works](#how-it-works)
    - [Generating a story](#generating-a-story)
    - [Story format](#story-format)
    - [Data model](#data-model)
  - [Tech stack](#tech-stack)
  - [Project structure](#project-structure)
  - [Getting started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [1. Clone the repository](#1-clone-the-repository)
    - [2. Start the LLM server](#2-start-the-llm-server)
    - [3. Set up and run the backend](#3-set-up-and-run-the-backend)
    - [4. Set up and run the frontend](#4-set-up-and-run-the-frontend)
  - [Configuration](#configuration)
    - [Using a different model or provider](#using-a-different-model-or-provider)
  - [Usage](#usage)
    - [In the browser](#in-the-browser)
    - [Through the API](#through-the-api)
  - [API reference](#api-reference)
  - [Development](#development)
  - [Known limitations](#known-limitations)
  - [Contributing](#contributing)
  - [Author](#author)

## Features

- **Any theme.** "Pirates", "haunted lighthouse", "cyberpunk heist": the theme is the only input.
- **Branching paths and endings.** Each scene offers 1 to 4 choices, paths vary in length, and every story has at least one winning ending alongside losing ones.
- **Whole story generated up front.** The model writes the full tree in one request, so once it is ready, every choice loads instantly.
- **Background generation.** Creating a story returns a job ID immediately; the frontend polls the job until the story is ready.
- **Saved, linkable stories.** Every story is stored in the database and can be reopened at `/story/<id>`.
- **Runs locally.** Works with a model on your own machine through LM Studio, or with a hosted OpenAI-compatible API.

## How it works

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as React frontend<br/>(Vite, port 5173)
    participant API as FastAPI backend<br/>(port 8000)
    participant DB as Database<br/>(SQLite or PostgreSQL)
    participant LLM as LLM endpoint<br/>(OpenAI-compatible)

    User->>UI: Enter a theme
    UI->>API: POST /api/stories/create
    API->>DB: Insert job (pending)
    API-->>UI: job_id + session_id cookie
    par Background task
        API->>DB: Set job to processing
        API->>LLM: System prompt + theme
        LLM-->>API: Full story tree as JSON
        API->>DB: Save story and nodes, set job to completed
    and Frontend polling
        loop Every 5 s until completed or failed
            UI->>API: GET /api/jobs/{job_id}
            API-->>UI: status, story_id
        end
    end
    UI->>API: GET /api/stories/{story_id}/complete
    API-->>UI: Title, root node, all nodes
    User->>UI: Choose options until an ending
```

### Generating a story

1. `POST /api/stories/create` stores a `StoryJob` with status `pending`, sets an HTTP-only `session_id` cookie, and schedules a FastAPI background task ([backend/routers/story.py](backend/routers/story.py)).
2. The task marks the job `processing` and calls `StoryGenerator.generate_story` ([backend/core/story_generator.py](backend/core/story_generator.py)).
3. The generator builds a LangChain chat prompt from the system prompt in [backend/core/prompts.py](backend/core/prompts.py) and the message `Create the story for the theme: <theme>`. A `PydanticOutputParser` adds JSON format instructions derived from the models in [backend/core/models.py](backend/core/models.py), so the model answers with a single nested JSON object.
4. The response is parsed and validated, then walked recursively. Every scene becomes a `StoryNode` row, and every option stores its text plus the ID of the node it leads to.
5. The job is marked `completed` with the new `story_id`, or `failed` with the error message if any step raised an exception.

### Story format

The model returns the story as a nested tree:

```json
{
  "title": "The Cursed Compass",
  "rootNode": {
    "content": "Your ship drifts into a fog bank...",
    "isEnding": false,
    "isWinningEnding": false,
    "options": [
      {
        "text": "Follow the compass",
        "nextNode": { "content": "...", "isEnding": false, "isWinningEnding": false, "options": ["..."] }
      }
    ]
  }
}
```

The backend flattens that tree into rows, replacing each nested `nextNode` with a `node_id` reference. The frontend downloads every node of a story in one request and moves between them locally, so playing needs no further network calls.

### Data model

| Table | Holds | Columns |
| --- | --- | --- |
| `story_jobs` | One row per generation request | `job_id` (UUID), `session_id`, `theme`, `status`, `story_id`, `error`, `created_at`, `completed_at` |
| `stories` | Generated stories | `id`, `title`, `session_id`, `created_at` |
| `story_nodes` | Scenes within a story | `id`, `story_id` (FK to `stories.id`), `content`, `is_root`, `is_ending`, `is_winning_ending`, `options` (JSON list of `{text, node_id}`) |

Tables are created automatically when the backend starts (`create_tables()` in [backend/main.py](backend/main.py)). There are no migrations.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Backend | Python 3.11+, FastAPI, Uvicorn, Pydantic, pydantic-settings |
| AI | LangChain with `langchain-openai` (`ChatOpenAI`) against an OpenAI-compatible endpoint. Default model: `google/gemma-3-12b` served by LM Studio |
| Database | SQLAlchemy 2. SQLite by default; PostgreSQL supported through `psycopg2-binary` |
| Frontend | React 19, React Router 7, Axios, Vite 7, ESLint 9 |
| Tooling | [uv](https://docs.astral.sh/uv/) for Python dependencies (`uv.lock`), npm for JavaScript (`package-lock.json`) |

## Project structure

```text
InteractiveStories/
├── backend/                       FastAPI service
│   ├── main.py                    App entry point: CORS, routers, table creation, dev server
│   ├── core/
│   │   ├── config.py              Settings loaded from environment variables / .env
│   │   ├── prompts.py             System prompt for story generation
│   │   ├── models.py              Pydantic models describing the LLM's JSON output
│   │   └── story_generator.py     LLM call, response parsing, saving the story tree
│   ├── db/database.py             Engine, session factory, get_db dependency
│   ├── models/                    SQLAlchemy ORM models (StoryJob, Story, StoryNode)
│   ├── routers/                   API routes: /stories and /jobs
│   ├── schemas/                   Pydantic request and response schemas
│   ├── .env.example               Configuration template
│   ├── pyproject.toml             Python project metadata and dependencies
│   └── uv.lock                    Locked dependency versions
└── frontend/                      React single-page app
    ├── src/
    │   ├── App.jsx                Routes: / and /story/:id
    │   ├── components/
    │   │   ├── StoryGenerator.jsx Theme submission and job polling
    │   │   ├── ThemeInput.jsx     Theme form with validation
    │   │   ├── LoadingStatus.jsx  Spinner shown while waiting
    │   │   ├── StoryLoader.jsx    Loads a story by ID
    │   │   └── StoryGame.jsx      Plays a story: scenes, choices, endings
    │   └── util.js                API base path (/api)
    ├── vite.config.js             Dev server config and /api proxy to the backend
    └── package.json               Scripts and dependencies
```

## Getting started

### Prerequisites

- **Python 3.11 or newer** and **[uv](https://docs.astral.sh/uv/getting-started/installation/)** (recommended; plain pip also works, see below)
- **Node.js 20.19+ or 22.12+** (required by Vite 7) and npm
- **An OpenAI-compatible LLM endpoint.** The default setup is [LM Studio](https://lmstudio.ai/) running `google/gemma-3-12b` locally. To use something else, see [Using a different model or provider](#using-a-different-model-or-provider).

### 1. Clone the repository

```bash
git clone https://github.com/alex49ma/InteractiveStories.git
cd InteractiveStories
```

### 2. Start the LLM server

1. Install [LM Studio](https://lmstudio.ai/) and download the **google/gemma-3-12b** model.
2. Start the local server from the **Developer** tab. It listens on `http://localhost:1234/v1`, which is the backend's default `BASE_URL`.

If you prefer LM Studio's `lms` command-line tool:

```bash
lms get google/gemma-3-12b
lms load google/gemma-3-12b
lms server start
```

### 3. Set up and run the backend

```bash
cd backend
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
```

Open `.env` and set `GEMINI_API_KEY`. For a local LM Studio server, a placeholder such as `lm-studio` is enough. The defaults for everything else work for local development.

```bash
uv sync            # creates .venv and installs the locked dependencies
uv run main.py     # starts the API on http://localhost:8000 with auto-reload
```

Run backend commands from inside `backend/`. The modules import each other as top-level packages (`from core.config import settings`), and `.env` is read from the current directory.

To check that it works, open the interactive API docs at <http://localhost:8000/docs>.

<details>
<summary>Without uv</summary>

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install "fastapi[all]>=0.123.0" "langchain>=1.1.0" "langchain-openai>=1.1.1" \
            "psycopg2-binary>=2.9.11" "python-dotenv>=1.2.1" "sqlalchemy>=2.0.44" "uvicorn>=0.38.0"
python main.py
```

</details>

### 4. Set up and run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server forwards every `/api` request to `http://localhost:8000`, so the frontend needs no configuration of its own.

## Configuration

The backend reads its settings from environment variables or from `backend/.env`; environment variables take precedence. Names are case-sensitive. [backend/.env.example](backend/.env.example) lists all of them.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | (none) | SQLAlchemy connection URL. `.env.example` uses `sqlite:///./database.db`, a file inside `backend/`. For PostgreSQL: `postgresql://user:password@localhost:5432/interactive_stories` |
| `GEMINI_API_KEY` | Yes | (none) | API key sent to the LLM endpoint. Despite the name, it goes to whatever endpoint `BASE_URL` points at. For LM Studio, any placeholder such as `lm-studio` works |
| `BASE_URL` | No | `http://localhost:1234/v1` | Base URL of the OpenAI-compatible API used for generation |
| `ALLOWED_ORIGINS` | No | empty | Comma-separated origins allowed by CORS, for example `http://localhost:5173,http://localhost:3000`. Only needed when a browser calls the API directly instead of through the Vite proxy |
| `API_PREFIX` | No | `/api` | Path prefix for all API routes. The frontend expects `/api` (see [frontend/src/util.js](frontend/src/util.js) and [frontend/vite.config.js](frontend/vite.config.js)) |
| `DEBUG` | No | `False` | Loaded into the settings object but not used by the app yet |

### Using a different model or provider

The model name is set in code, not in configuration: `model="google/gemma-3-12b"` in [backend/core/story_generator.py](backend/core/story_generator.py#L16).

- **Another local model:** load it in LM Studio and change that string to the model's identifier.
- **A hosted API:** point `BASE_URL` at any OpenAI-compatible endpoint, put the provider's key in `GEMINI_API_KEY`, and change the model string. For Google Gemini, for example, use `BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`, a key from [Google AI Studio](https://aistudio.google.com/apikey), and a Gemini model ID.

The whole story arrives as one long JSON response, so choose a model that reliably produces long, well-formed JSON. If the output cannot be parsed, the job fails and the parser's error message is stored on the job.

## Usage

### In the browser

1. Open <http://localhost:5173>, enter a theme and click **Generate Story**.
2. A spinner appears while the story is generated. How long this takes depends on the model and your hardware.
3. When the story is ready you are taken to `/story/<id>`. Read the scene and pick one of the options under **What will you do?**
4. Each ending is either a winning or a losing ending. **Restart Story** returns to the first scene, and **New Story** takes you back to the theme form.

Stories are stored in the database, so you can bookmark a story's URL and open it again later.

### Through the API

```bash
# 1. Start a generation job
curl -X POST http://localhost:8000/api/stories/create \
  -H "Content-Type: application/json" \
  -d '{"theme": "pirates"}'

# 2. Poll the job until "status" is "completed" (or "failed")
curl http://localhost:8000/api/jobs/<job_id>

# 3. Fetch the full story using the job's story_id
curl http://localhost:8000/api/stories/<story_id>/complete
```

You can also run the same requests from the **Try it out** buttons at <http://localhost:8000/docs>.

## API reference

All routes are served under `/api` (configurable with `API_PREFIX`). FastAPI also generates interactive documentation at `/docs` (Swagger UI) and `/redoc` (ReDoc), outside the prefix.

| Method | Path | Description | Responses |
| --- | --- | --- | --- |
| `POST` | `/api/stories/create` | Starts generating a story. Body: `{"theme": "<string>"}`. Sets an HTTP-only `session_id` cookie if the request has none | `200` job object, `422` invalid body |
| `GET` | `/api/jobs/{job_id}` | Returns the status of a generation job | `200` job object, `404` job not found |
| `GET` | `/api/stories/{story_id}/complete` | Returns a story with all of its nodes | `200` story object, `404` story not found, `500` story has no root node |

**Job object.** `status` moves from `pending` to `processing`, then to `completed` (with `story_id` set) or `failed` (with `error` set).

```json
{
  "job_id": "970cb470-c869-4321-a1d5-4ecd12612ec8",
  "status": "completed",
  "created_at": "2026-11-10T12:02:11",
  "story_id": 1,
  "completed_at": "2026-11-10T12:03:05",
  "error": null
}
```

**Story object.** `all_nodes` contains every node of the story, the root included, keyed by node ID. Ending nodes have an empty `options` list.

```json
{
  "id": 1,
  "title": "The Cursed Compass",
  "session_id": "5f0c2a9e-...",
  "created_at": "2026-11-10T12:03:05",
  "root_node": {
    "id": 1,
    "content": "Your ship drifts into a fog bank...",
    "is_ending": false,
    "is_winning_ending": false,
    "options": [
      { "text": "Follow the compass", "node_id": 2 },
      { "text": "Turn back to port", "node_id": 7 }
    ]
  },
  "all_nodes": {
    "1": { "id": 1, "content": "Your ship drifts into a fog bank...", "is_ending": false, "is_winning_ending": false, "options": ["..."] },
    "2": { "id": 2, "content": "...", "is_ending": false, "is_winning_ending": false, "options": ["..."] }
  }
}
```

## Development

| Task | Command | Run in |
| --- | --- | --- |
| Run the API with auto-reload | `uv run main.py` (or `uv run uvicorn main:app --reload`) | `backend/` |
| Run the frontend dev server | `npm run dev` | `frontend/` |
| Lint the frontend | `npm run lint` | `frontend/` |
| Build the frontend for production | `npm run build` (output in `frontend/dist/`) | `frontend/` |
| Preview the production build | `npm run preview` | `frontend/` |

- **Resetting data.** With the default SQLite database, stop the backend and delete `backend/database.db`. The tables are recreated on the next start. Because there are no migrations, changes to the models in [backend/models/](backend/models/) also require this reset on an existing database.
- **Debugging generation.** The generator prints the raw LLM response to the backend console (lines starting with `DEBUG:`), which helps when a model returns malformed JSON. Failed jobs keep the exception message in their `error` field, visible through `GET /api/jobs/{job_id}`.
- **Changing the stories.** The rules the model follows (number of options, endings, path variety) live in the system prompt in [backend/core/prompts.py](backend/core/prompts.py). The JSON shape is enforced by the Pydantic models in [backend/core/models.py](backend/core/models.py).
- **Tests.** There are no automated tests yet.

## Known limitations

- The model name is hard-coded rather than configurable (see [Using a different model or provider](#using-a-different-model-or-provider)).
- Each story comes from a single LLM response, so its size is limited by the model's output length. A response that is not valid JSON fails the job, and there is no automatic retry.
- There is no authentication. Anyone who knows a story's ID can open it. Each story records the `session_id` cookie, but nothing uses it yet to restrict access or list a user's stories.
- The `/api` proxy exists only in the Vite dev server, and the backend does not serve the built frontend. A production deployment needs a reverse proxy, or `ALLOWED_ORIGINS` set and the frontend pointed at the backend's URL.

## Contributing

This is a personal project. Bug reports and suggestions are welcome through [GitHub Issues](https://github.com/alex49ma/InteractiveStories/issues).

## Author

**Alejandro Martín**: [github.com/alex49ma](https://github.com/alex49ma)
