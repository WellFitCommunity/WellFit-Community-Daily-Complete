# AI Coding Mistakes — Python

> **Governance Reference Document**
> Envision Virtual Edge Group LLC — AI Development Methodology
>
> This document catalogs the frequent mistakes AI coding assistants make when writing Python. Each entry includes the wrong pattern, the right pattern, and why AI models get it wrong.

---

## Table of Contents

1. [Type Safety & Type Hints](#1-type-safety--type-hints)
2. [Error Handling](#2-error-handling)
3. [Mutable Default Arguments](#3-mutable-default-arguments)
4. [Import Anti-Patterns](#4-import-anti-patterns)
5. [String Handling](#5-string-handling)
6. [Async / Await](#6-async--await)
7. [File & Resource Management](#7-file--resource-management)
8. [Security Vulnerabilities](#8-security-vulnerabilities)
9. [Data Structures & Iteration](#9-data-structures--iteration)
10. [Class & OOP Mistakes](#10-class--oop-mistakes)
11. [Testing Anti-Patterns](#11-testing-anti-patterns)
12. [Environment & Dependency Management](#12-environment--dependency-management)
13. [Logging & Debugging](#13-logging--debugging)
14. [Performance Pitfalls](#14-performance-pitfalls)
15. [Database & ORM Mistakes](#15-database--orm-mistakes)
16. [API & Web Framework Mistakes](#16-api--web-framework-mistakes)

---

## 1. Type Safety & Type Hints

### 1.1 Missing type hints entirely

| Wrong | Right |
|-------|-------|
| `def process(data):` | `def process(data: dict[str, Any]) -> ProcessResult:` |

**Why AI does this:** Training data is full of untyped Python 2-era code. AI defaults to the shortest signature.

### 1.2 Using `Any` as a crutch

| Wrong | Right |
|-------|-------|
| `def fetch(url: str) -> Any:` | `def fetch(url: str) -> Response \| None:` |
| `items: list[Any]` | `items: list[PatientRecord]` |

**Why AI does this:** Same reason as TypeScript `any` — it compiles and feels "flexible."

### 1.3 Ignoring `Optional` vs union syntax

| Wrong | Right (3.10+) | Right (3.9 and below) |
|-------|---------------|----------------------|
| `def get(id: str) -> Patient:` (can return None) | `def get(id: str) -> Patient \| None:` | `def get(id: str) -> Optional[Patient]:` |

**Why AI does this:** AI doesn't check which Python version you're targeting. It picks whichever syntax it saw most recently in training data.

### 1.4 Using `dict` when a dataclass or TypedDict is appropriate

```python
# ❌ WRONG — unstructured, no validation, no IDE support
patient = {"name": "Test", "age": 45, "risk": "high"}

# ✅ RIGHT — structured, validated, IDE-friendly
@dataclass
class Patient:
    name: str
    age: int
    risk: RiskLevel

patient = Patient(name="Test Patient Alpha", age=45, risk=RiskLevel.HIGH)
```

**Why AI does this:** Dicts are faster to type. AI optimizes for generation speed, not maintainability.

---

## 2. Error Handling

### 2.1 Bare `except` clause

```python
# ❌ WRONG — catches SystemExit, KeyboardInterrupt, everything
try:
    result = process(data)
except:
    pass

# ❌ ALSO WRONG — catches too broadly
try:
    result = process(data)
except Exception:
    pass

# ✅ RIGHT — catch specific exceptions
try:
    result = process(data)
except ValueError as e:
    logger.error("Invalid data format", exc_info=e)
    return failure("VALIDATION_ERROR", str(e))
except ConnectionError as e:
    logger.error("Database unreachable", exc_info=e)
    return failure("CONNECTION_ERROR", "Service unavailable")
```

**Why AI does this:** Bare `except` makes the error "go away." AI sees absence of errors as success.

### 2.2 Swallowing exceptions silently

```python
# ❌ WRONG — exception vanishes, debugging is impossible
try:
    save_record(patient)
except Exception:
    pass

# ✅ RIGHT — log it, surface it, handle it
try:
    save_record(patient)
except DatabaseError as e:
    logger.error("Failed to save patient record", exc_info=e, extra={"patient_id": patient.id})
    raise ServiceError("Record save failed") from e
```

**Why AI does this:** The `pass` keyword makes the code "work." AI conflates "no crash" with "correct behavior."

### 2.3 Re-raising without context

```python
# ❌ WRONG — original traceback lost
except ValueError:
    raise RuntimeError("Processing failed")

# ✅ RIGHT — chain the exception
except ValueError as e:
    raise RuntimeError("Processing failed") from e
```

**Why AI does this:** AI doesn't think about the developer who has to debug this at 2 AM.

### 2.4 Using `assert` for runtime validation

```python
# ❌ WRONG — assert is stripped with python -O (optimized mode)
assert user_id is not None, "user_id required"

# ✅ RIGHT — explicit validation
if user_id is None:
    raise ValueError("user_id is required")
```

**Why AI does this:** `assert` is shorter. AI sees it used in tests and applies it everywhere.

---

## 3. Mutable Default Arguments

### 3.1 The classic mutable default trap

```python
# ❌ WRONG — the list is shared across ALL calls
def add_item(item: str, items: list[str] = []) -> list[str]:
    items.append(item)
    return items

# First call: add_item("a") → ["a"]
# Second call: add_item("b") → ["a", "b"]  ← BUG

# ✅ RIGHT — use None sentinel
def add_item(item: str, items: list[str] | None = None) -> list[str]:
    if items is None:
        items = []
    items.append(item)
    return items
```

**Why AI does this:** This is Python's most famous gotcha and AI STILL gets it wrong because `= []` looks cleaner than the None pattern. Training data is full of both patterns.

### 3.2 Mutable defaults in dataclasses

```python
# ❌ WRONG — ValueError at definition time (Python catches this one)
@dataclass
class Config:
    tags: list[str] = []

# ✅ RIGHT — use field with default_factory
@dataclass
class Config:
    tags: list[str] = field(default_factory=list)
```

**Why AI does this:** AI knows the `@dataclass` decorator but doesn't always remember the `field()` requirement for mutable defaults.

---

## 4. Import Anti-Patterns

### 4.1 Wildcard imports

```python
# ❌ WRONG — pollutes namespace, hides dependencies
from utils import *
from models import *

# ✅ RIGHT — explicit imports
from utils import validate_input, sanitize_string
from models import Patient, Encounter
```

**Why AI does this:** `import *` is fewer characters. AI optimizes for brevity.

### 4.2 Circular imports

```python
# ❌ WRONG — module A imports B, B imports A → ImportError
# models.py
from services import PatientService  # services.py imports models.py

# ✅ RIGHT — use TYPE_CHECKING for type-only imports
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from services import PatientService
```

**Why AI does this:** AI generates files in isolation. It doesn't track the full import graph.

### 4.3 Import at the top of a function for no reason

```python
# ❌ WRONG — unnecessary deferred import, harder to track dependencies
def process():
    import json
    return json.loads(data)

# ✅ RIGHT — import at module level
import json

def process():
    return json.loads(data)
```

Exception: Deferred imports are appropriate for optional dependencies or circular import breaking.

**Why AI does this:** AI sometimes "plays it safe" by putting imports close to usage, not understanding that it obscures the module's dependency list.

---

## 5. String Handling

### 5.1 String concatenation in loops

```python
# ❌ WRONG — O(n²) because strings are immutable
result = ""
for item in items:
    result += f"{item.name}, "

# ✅ RIGHT — join is O(n)
result = ", ".join(item.name for item in items)
```

**Why AI does this:** `+=` is the intuitive pattern. AI doesn't consider the algorithmic cost.

### 5.2 Using `%` or `.format()` instead of f-strings

```python
# ❌ OUTDATED
msg = "Patient %s has risk %s" % (name, risk)
msg = "Patient {} has risk {}".format(name, risk)

# ✅ MODERN (Python 3.6+)
msg = f"Patient {name} has risk {risk}"
```

**Why AI does this:** Training data contains decades of Python. Older formatting styles are heavily represented.

### 5.3 Not using raw strings for regex

```python
# ❌ WRONG — backslashes get interpreted by Python first
pattern = re.compile("\d{3}-\d{2}-\d{4}")  # May not match as expected

# ✅ RIGHT — raw string, regex engine gets the literal backslashes
pattern = re.compile(r"\d{3}-\d{2}-\d{4}")
```

**Why AI does this:** The `r` prefix is easy to forget, and the code often "works" without it for simple patterns.

---

## 6. Async / Await

### 6.1 Blocking calls inside async functions

```python
# ❌ WRONG — time.sleep blocks the entire event loop
async def process():
    time.sleep(5)  # Blocks everything
    return await fetch_data()

# ✅ RIGHT — use async sleep
async def process():
    await asyncio.sleep(5)
    return await fetch_data()
```

**Why AI does this:** AI mixes sync and async patterns freely because both "work" in isolation.

### 6.2 Forgetting to await coroutines

```python
# ❌ WRONG — returns a coroutine object, not the result
async def handler():
    result = fetch_patient(patient_id)  # Missing await!
    return result  # Returns <coroutine object>

# ✅ RIGHT
async def handler():
    result = await fetch_patient(patient_id)
    return result
```

**Why AI does this:** The code looks correct. There's no syntax error. The bug only appears at runtime.

### 6.3 Creating a new event loop unnecessarily

```python
# ❌ WRONG — creates a new loop, conflicts with existing loop in web frameworks
loop = asyncio.get_event_loop()
result = loop.run_until_complete(coroutine())

# ✅ RIGHT — use asyncio.run() at the top level, or await inside async context
result = asyncio.run(coroutine())  # Top-level entry point only

# Inside an async function:
result = await coroutine()
```

**Why AI does this:** `get_event_loop()` + `run_until_complete()` is the pattern from Python 3.4 tutorials. AI doesn't realize it's been superseded.

---

## 7. File & Resource Management

### 7.1 Not using context managers

```python
# ❌ WRONG — file handle leaks if exception occurs
f = open("data.json")
data = json.load(f)
f.close()  # Never reached if json.load() raises

# ✅ RIGHT — guaranteed cleanup
with open("data.json") as f:
    data = json.load(f)
```

**Why AI does this:** The explicit open/close pattern exists in training data and "looks right."

### 7.2 Hardcoded file paths

```python
# ❌ WRONG — breaks on Windows, breaks in containers
config_path = "/home/user/app/config.json"

# ✅ RIGHT — use pathlib
from pathlib import Path
config_path = Path(__file__).parent / "config.json"
```

**Why AI does this:** AI generates code for the platform it thinks you're on, defaulting to Unix paths.

### 7.3 Not specifying encoding

```python
# ❌ WRONG — encoding is platform-dependent (Windows defaults to cp1252)
with open("data.txt") as f:
    content = f.read()

# ✅ RIGHT — explicit encoding
with open("data.txt", encoding="utf-8") as f:
    content = f.read()
```

**Why AI does this:** The encoding parameter is "optional" and most training data omits it.

---

## 8. Security Vulnerabilities

### 8.1 SQL injection via string formatting

```python
# ❌ WRONG — SQL injection
query = f"SELECT * FROM patients WHERE id = '{patient_id}'"
cursor.execute(query)

# ✅ RIGHT — parameterized query
cursor.execute("SELECT * FROM patients WHERE id = %s", (patient_id,))

# ✅ ALSO RIGHT — ORM
patient = Patient.objects.get(id=patient_id)
```

**Why AI does this:** f-strings are the "modern" way to build strings. AI doesn't distinguish between string building and query building.

### 8.2 Using `eval()` or `exec()`

```python
# ❌ WRONG — arbitrary code execution
result = eval(user_input)
exec(user_provided_code)

# ✅ RIGHT — use ast.literal_eval for safe parsing
import ast
result = ast.literal_eval(user_input)  # Only parses literals

# ✅ RIGHT — use json.loads for structured data
result = json.loads(user_input)
```

**Why AI does this:** `eval()` is the "easy" way to convert strings to Python objects. AI doesn't consider the attack surface.

### 8.3 Hardcoded secrets

```python
# ❌ WRONG — secrets in source code
API_KEY = "sk-abc123def456"
DB_PASSWORD = "admin123"

# ✅ RIGHT — environment variables
import os
API_KEY = os.environ["API_KEY"]
DB_PASSWORD = os.environ["DB_PASSWORD"]

# ✅ BETTER — with validation
API_KEY = os.environ.get("API_KEY")
if not API_KEY:
    raise EnvironmentError("API_KEY environment variable is required")
```

**Why AI does this:** AI generates "working" code. Environment variables require setup outside the code.

### 8.4 Using `pickle` on untrusted data

```python
# ❌ WRONG — pickle can execute arbitrary code during deserialization
import pickle
data = pickle.loads(untrusted_bytes)  # Remote code execution risk

# ✅ RIGHT — use JSON or a safe serialization format
import json
data = json.loads(untrusted_string)
```

**Why AI does this:** `pickle` is Python-native and handles complex objects. AI doesn't assess trust boundaries.

### 8.5 Insecure randomness

```python
# ❌ WRONG — predictable, not cryptographically secure
import random
token = ''.join(random.choices('abcdef0123456789', k=32))

# ✅ RIGHT — cryptographically secure
import secrets
token = secrets.token_hex(16)
```

**Why AI does this:** `random` is the first module AI reaches for. It doesn't distinguish between "random for games" and "random for security."

---

## 9. Data Structures & Iteration

### 9.1 Modifying a list while iterating

```python
# ❌ WRONG — skips elements, unpredictable behavior
for item in items:
    if item.is_expired():
        items.remove(item)

# ✅ RIGHT — build a new list
items = [item for item in items if not item.is_expired()]

# ✅ ALSO RIGHT — iterate over a copy
for item in items[:]:
    if item.is_expired():
        items.remove(item)
```

**Why AI does this:** The code reads naturally in English: "for each item, remove if expired." AI follows natural language, not Python semantics.

### 9.2 Using `list` when `set` or `dict` is appropriate

```python
# ❌ WRONG — O(n) lookup
if patient_id in patient_list:  # Scans entire list
    ...

# ✅ RIGHT — O(1) lookup
if patient_id in patient_set:  # Hash lookup
    ...
```

**Why AI does this:** Lists are the "default" collection. AI doesn't optimize for access patterns.

### 9.3 Not using `enumerate`

```python
# ❌ WRONG — manual index tracking
i = 0
for item in items:
    print(f"{i}: {item}")
    i += 1

# ✅ RIGHT
for i, item in enumerate(items):
    print(f"{i}: {item}")
```

**Why AI does this:** The manual pattern exists heavily in training data from other languages.

### 9.4 Nested loops when a dict/set lookup suffices

```python
# ❌ WRONG — O(n*m)
for patient in patients:
    for appointment in appointments:
        if appointment.patient_id == patient.id:
            match(patient, appointment)

# ✅ RIGHT — O(n+m)
appointment_map = {a.patient_id: a for a in appointments}
for patient in patients:
    if patient.id in appointment_map:
        match(patient, appointment_map[patient.id])
```

**Why AI does this:** Nested loops are the "obvious" solution. AI doesn't consider algorithmic complexity.

---

## 10. Class & OOP Mistakes

### 10.1 Mutable class variables shared across instances

```python
# ❌ WRONG — all instances share the same list
class Patient:
    medications: list[str] = []  # Class variable, NOT instance variable

# patient_a.medications.append("aspirin")
# patient_b.medications → ["aspirin"]  ← BUG: shared state

# ✅ RIGHT — initialize in __init__
class Patient:
    def __init__(self):
        self.medications: list[str] = []
```

**Why AI does this:** The class-level annotation looks like a type hint. AI confuses type annotation with default value.

### 10.2 Not calling `super().__init__()`

```python
# ❌ WRONG — parent initialization skipped
class SpecialistProvider(Provider):
    def __init__(self, specialty: str):
        self.specialty = specialty  # Parent fields not initialized!

# ✅ RIGHT
class SpecialistProvider(Provider):
    def __init__(self, specialty: str, **kwargs):
        super().__init__(**kwargs)
        self.specialty = specialty
```

**Why AI does this:** AI generates the child class without referencing the parent's `__init__` signature.

### 10.3 Using `__del__` for cleanup

```python
# ❌ WRONG — __del__ timing is unpredictable, may never be called
class Connection:
    def __del__(self):
        self.close()

# ✅ RIGHT — use context manager protocol
class Connection:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
```

**Why AI does this:** `__del__` is the "destructor" pattern from C++/Java. AI applies it to Python without understanding GC differences.

---

## 11. Testing Anti-Patterns

### 11.1 Testing implementation instead of behavior

```python
# ❌ WRONG — tests internal method calls, breaks on any refactor
def test_process_patient():
    with patch.object(service, '_internal_validate') as mock:
        service.process(patient)
        mock.assert_called_once()

# ✅ RIGHT — tests the observable output
def test_process_patient_returns_risk_score():
    result = service.process(test_patient)
    assert result.risk_level == "high"
    assert result.score >= 0.8
```

**Why AI does this:** Mocking internals is "thorough." AI confuses coverage with quality.

### 11.2 Over-mocking to the point of testing nothing

```python
# ❌ WRONG — everything is mocked, test proves nothing
def test_save_patient():
    with patch('db.connect'), patch('db.insert'), patch('db.commit'):
        result = save_patient(mock_patient)
        assert result is True  # Of course it's True — you mocked everything

# ✅ RIGHT — test against a real or in-memory database
def test_save_patient(test_db):
    result = save_patient(test_patient)
    assert result.success
    saved = test_db.query(Patient).get(test_patient.id)
    assert saved.name == "Test Patient Alpha"
```

**Why AI does this:** Mocking is the path of least resistance. It avoids setup complexity by removing reality.

### 11.3 Using realistic-looking PHI in test fixtures

```python
# ❌ WRONG — looks real, triggers compliance flags
test_patient = {"name": "John Smith", "dob": "1958-03-15", "ssn": "123-45-6789"}

# ✅ RIGHT — obviously fake
test_patient = {"name": "Test Patient Alpha", "dob": "2000-01-01", "ssn": "000-00-0000"}
```

**Why AI does this:** AI generates "realistic" data to make tests look professional. It doesn't consider compliance implications.

### 11.4 No assertion messages

```python
# ❌ WRONG — failure says "AssertionError" with no context
assert result.status == "active"

# ✅ RIGHT — failure explains what went wrong
assert result.status == "active", f"Expected active status, got {result.status} for patient {patient.id}"
```

**Why AI does this:** The bare assertion is shorter. AI doesn't think about the developer reading the failure output.

---

## 12. Environment & Dependency Management

### 12.1 No `requirements.txt` or `pyproject.toml` pinning

```
# ❌ WRONG — unpinned, breaks on next update
requests
pandas
sqlalchemy

# ✅ RIGHT — pinned versions
requests==2.31.0
pandas==2.2.0
sqlalchemy==2.0.25
```

**Why AI does this:** AI generates the dependency list, not the lockfile. Pinning requires knowing the current version.

### 12.2 Installing packages globally instead of in a virtualenv

```bash
# ❌ WRONG
pip install flask

# ✅ RIGHT
python -m venv .venv
source .venv/bin/activate
pip install flask
```

**Why AI does this:** The global install is one command. AI doesn't consider environment isolation.

### 12.3 Using `os.environ` without defaults or validation

```python
# ❌ WRONG — KeyError if not set, no helpful message
db_url = os.environ["DATABASE_URL"]

# ✅ RIGHT — validated with clear error
db_url = os.environ.get("DATABASE_URL")
if not db_url:
    raise EnvironmentError(
        "DATABASE_URL is required. Set it in .env or environment."
    )
```

**Why AI does this:** Direct dict access is shorter. AI assumes the variable exists.

---

## 13. Logging & Debugging

### 13.1 Using `print()` instead of `logging`

```python
# ❌ WRONG — no levels, no formatting, no control
print(f"Processing patient {patient_id}")
print(f"Error: {e}")

# ✅ RIGHT — structured logging
import logging
logger = logging.getLogger(__name__)

logger.info("Processing patient", extra={"patient_id": patient_id})
logger.error("Processing failed", exc_info=e, extra={"patient_id": patient_id})
```

**Why AI does this:** `print()` is the first thing every Python tutorial teaches. It's AI's muscle memory.

### 13.2 Logging sensitive data

```python
# ❌ WRONG — PHI in logs
logger.info(f"Patient {patient.name} SSN {patient.ssn} updated")

# ✅ RIGHT — log identifiers only
logger.info("Patient record updated", extra={"patient_id": patient.id})
```

**Why AI does this:** AI doesn't distinguish between identifiers and sensitive data. It logs whatever is available.

### 13.3 Not configuring log levels

```python
# ❌ WRONG — default config, DEBUG in production
logging.basicConfig()

# ✅ RIGHT — environment-aware configuration
import os
log_level = os.environ.get("LOG_LEVEL", "INFO")
logging.basicConfig(
    level=getattr(logging, log_level),
    format="%(asctime)s %(name)s %(levelname)s %(message)s"
)
```

**Why AI does this:** `basicConfig()` with no args is the quickest way to "make logging work."

---

## 14. Performance Pitfalls

### 14.1 Loading entire files into memory

```python
# ❌ WRONG — OOM on large files
with open("huge_dataset.csv") as f:
    data = f.readlines()  # Entire file in memory

# ✅ RIGHT — stream line by line
with open("huge_dataset.csv") as f:
    for line in f:  # Lazy iteration
        process(line)

# ✅ ALSO RIGHT — use pandas chunking for CSV
for chunk in pd.read_csv("huge_dataset.csv", chunksize=10000):
    process(chunk)
```

**Why AI does this:** `readlines()` is the "obvious" way to read a file. AI doesn't consider file sizes.

### 14.2 Repeated database queries in loops (N+1 problem)

```python
# ❌ WRONG — N+1 queries
for patient in patients:
    meds = db.query(Medication).filter_by(patient_id=patient.id).all()

# ✅ RIGHT — batch query
patient_ids = [p.id for p in patients]
all_meds = db.query(Medication).filter(Medication.patient_id.in_(patient_ids)).all()
meds_by_patient = defaultdict(list)
for med in all_meds:
    meds_by_patient[med.patient_id].append(med)
```

**Why AI does this:** The loop pattern reads naturally. AI doesn't count queries.

### 14.3 Not using generators for large sequences

```python
# ❌ WRONG — creates entire list in memory
def get_all_records():
    return [transform(r) for r in db.fetch_all()]  # Could be millions

# ✅ RIGHT — yields one at a time
def get_all_records():
    for r in db.fetch_all():
        yield transform(r)
```

**Why AI does this:** List comprehensions are AI's favorite Python idiom. Generators are "advanced."

---

## 15. Database & ORM Mistakes

### 15.1 Not closing database connections

```python
# ❌ WRONG — connection pool exhaustion
def get_patient(patient_id):
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM patients WHERE id = %s", (patient_id,))
    return cursor.fetchone()  # Connection never closed

# ✅ RIGHT — context manager
def get_patient(patient_id):
    with psycopg2.connect(DB_URL) as conn:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, name FROM patients WHERE id = %s", (patient_id,))
            return cursor.fetchone()
```

**Why AI does this:** The connection close is "after the interesting code." AI focuses on the query, not the lifecycle.

### 15.2 SELECT * in ORM queries

```python
# ❌ WRONG — fetches all columns, wastes bandwidth
patients = session.query(Patient).all()

# ✅ RIGHT — select only needed columns
patients = session.query(Patient.id, Patient.name, Patient.risk_level).all()
```

**Why AI does this:** `.all()` is the simplest query. AI doesn't consider column selection.

### 15.3 Not using transactions

```python
# ❌ WRONG — partial writes on failure
def transfer_patient(from_unit, to_unit, patient_id):
    remove_from_unit(from_unit, patient_id)  # Succeeds
    add_to_unit(to_unit, patient_id)          # Fails → patient is in neither unit

# ✅ RIGHT — atomic transaction
def transfer_patient(from_unit, to_unit, patient_id):
    with db.begin():
        remove_from_unit(from_unit, patient_id)
        add_to_unit(to_unit, patient_id)
        # Both succeed or both rollback
```

**Why AI does this:** Each operation "works" independently. AI doesn't think about partial failure.

---

## 16. API & Web Framework Mistakes

### 16.1 Not validating request input

```python
# ❌ WRONG — trusts client data
@app.route("/patient", methods=["POST"])
def create_patient():
    data = request.json
    patient = Patient(**data)  # Whatever the client sends becomes a patient

# ✅ RIGHT — validate with Pydantic or marshmallow
from pydantic import BaseModel, validator

class PatientCreate(BaseModel):
    name: str
    date_of_birth: date
    tenant_id: str

    @validator('name')
    def name_not_empty(cls, v):
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v

@app.route("/patient", methods=["POST"])
def create_patient():
    data = PatientCreate(**request.json)  # Validates automatically
```

**Why AI does this:** Validation is "extra code." AI generates the happy path.

### 16.2 Returning stack traces to clients

```python
# ❌ WRONG — exposes internals to attackers
@app.errorhandler(500)
def handle_error(e):
    return {"error": str(e), "traceback": traceback.format_exc()}, 500

# ✅ RIGHT — generic message to client, details to logs
@app.errorhandler(500)
def handle_error(e):
    logger.error("Internal error", exc_info=e)
    return {"error": "An internal error occurred"}, 500
```

**Why AI does this:** Detailed errors are "helpful." AI doesn't distinguish between developer debugging and client responses.

### 16.3 Synchronous I/O in async web frameworks

```python
# ❌ WRONG — blocks the event loop in FastAPI/Starlette
@app.get("/report")
async def get_report():
    data = open("report.csv").read()  # Blocking file I/O
    result = requests.get(API_URL)    # Blocking HTTP call
    return process(data, result)

# ✅ RIGHT — use async I/O
@app.get("/report")
async def get_report():
    async with aiofiles.open("report.csv") as f:
        data = await f.read()
    async with httpx.AsyncClient() as client:
        result = await client.get(API_URL)
    return process(data, result)
```

**Why AI does this:** AI uses `requests` and `open()` by default because they dominate training data. It doesn't check whether the framework is async.

---

## Summary — Top 10 Python Mistakes by Frequency

| # | Mistake | Section | Impact |
|---|---------|---------|--------|
| 1 | Bare `except` / silent exception swallowing | 2.1, 2.2 | Bugs invisible, impossible to debug |
| 2 | Mutable default arguments | 3.1 | Shared state corruption |
| 3 | `print()` instead of `logging` | 13.1 | No observability in production |
| 4 | SQL injection via f-strings | 8.1 | Critical security vulnerability |
| 5 | Missing type hints | 1.1 | No IDE support, no static analysis |
| 6 | N+1 database queries | 14.2 | Catastrophic performance at scale |
| 7 | No input validation on API endpoints | 16.1 | Data corruption, security risk |
| 8 | Blocking calls in async functions | 6.1 | Event loop stall, server unresponsive |
| 9 | Hardcoded secrets in source | 8.3 | Credential exposure in git history |
| 10 | Modifying collections while iterating | 9.1 | Skipped elements, unpredictable behavior |

---

*This document is part of the AI Development Methodology by Envision Virtual Edge Group LLC.*
*It is a governance tool — not a tutorial. Every entry exists because an AI got it wrong.*
