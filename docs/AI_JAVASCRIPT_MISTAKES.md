# AI Coding Mistakes — JavaScript

> **Governance Reference Document**
> Envision Virtual Edge Group LLC — AI Development Methodology
>
> This document catalogs the frequent mistakes AI coding assistants make when writing JavaScript (and TypeScript where noted). Each entry includes the wrong pattern, the right pattern, and why AI models get it wrong.

---

## Table of Contents

1. [Type Coercion & Equality](#1-type-coercion--equality)
2. [Variable Declarations](#2-variable-declarations)
3. [Async / Promises](#3-async--promises)
4. [Error Handling](#4-error-handling)
5. [`this` Binding & Context](#5-this-binding--context)
6. [Array & Object Manipulation](#6-array--object-manipulation)
7. [Scope & Closures](#7-scope--closures)
8. [Security Vulnerabilities](#8-security-vulnerabilities)
9. [DOM & Browser APIs](#9-dom--browser-apis)
10. [React-Specific Mistakes](#10-react-specific-mistakes)
11. [Node.js / Server-Side Mistakes](#11-nodejs--server-side-mistakes)
12. [Testing Anti-Patterns](#12-testing-anti-patterns)
13. [Module System Confusion](#13-module-system-confusion)
14. [Performance Pitfalls](#14-performance-pitfalls)
15. [TypeScript-Specific Mistakes](#15-typescript-specific-mistakes)
16. [Dependency & Build Tool Mistakes](#16-dependency--build-tool-mistakes)

---

## 1. Type Coercion & Equality

### 1.1 Using `==` instead of `===`

```javascript
// ❌ WRONG — type coercion causes surprises
if (value == 0)     // true for "", false, null (sometimes), 0
if (value == "")    // true for 0, false, ""
if (value == null)  // true for null AND undefined

// ✅ RIGHT — strict equality, no coercion
if (value === 0)
if (value === "")
if (value == null)  // Exception: == null is the idiomatic check for null OR undefined
```

**Why AI does this:** `==` is shorter. AI training data is full of both. In tutorials, `==` dominates.

### 1.2 Truthy/falsy confusion

```javascript
// ❌ WRONG — 0, "", NaN, and [] are all valid values that are falsy or truthy
if (count) { ... }       // Fails when count is legitimately 0
if (name) { ... }        // Fails when name is legitimately ""
if (items.length) { ... } // Works but unclear intent

// ✅ RIGHT — explicit checks
if (count !== undefined && count !== null) { ... }
if (typeof name === "string") { ... }
if (items.length > 0) { ... }
```

**Why AI does this:** Truthy/falsy checks are idiomatic JavaScript. AI doesn't consider edge cases like `0` or `""`.

### 1.3 Comparing objects by reference, not value

```javascript
// ❌ WRONG — always false (different references)
if ([1, 2, 3] === [1, 2, 3]) { ... }  // false
if ({ a: 1 } === { a: 1 }) { ... }    // false

// ✅ RIGHT — deep comparison
import { isEqual } from 'lodash';
if (isEqual(arr1, arr2)) { ... }

// Or for simple cases:
if (JSON.stringify(arr1) === JSON.stringify(arr2)) { ... }
```

**Why AI does this:** `===` on objects looks correct. AI applies the primitive equality pattern to reference types.

---

## 2. Variable Declarations

### 2.1 Using `var` instead of `let`/`const`

```javascript
// ❌ WRONG — var is function-scoped, hoisted, and leaks
for (var i = 0; i < 10; i++) {
  setTimeout(() => console.log(i), 100);  // Prints 10 ten times
}

// ✅ RIGHT — let is block-scoped
for (let i = 0; i < 10; i++) {
  setTimeout(() => console.log(i), 100);  // Prints 0-9
}
```

**Why AI does this:** Pre-ES6 training data uses `var` everywhere. AI doesn't always modernize.

### 2.2 Using `let` when `const` is appropriate

```javascript
// ❌ WRONG — signals "this will change" when it won't
let config = { port: 3000 };
let API_URL = "https://api.example.com";

// ✅ RIGHT — const for values that aren't reassigned
const config = { port: 3000 };  // Object is mutable, binding is not
const API_URL = "https://api.example.com";
```

**Why AI does this:** `let` feels "safer" because it works everywhere. AI doesn't analyze reassignment.

### 2.3 Assuming `const` means immutable

```javascript
// ❌ MISCONCEPTION — const prevents reassignment, NOT mutation
const patient = { name: "Test" };
patient.name = "Changed";  // This works! const ≠ frozen

// ✅ RIGHT — use Object.freeze for true immutability
const patient = Object.freeze({ name: "Test" });
patient.name = "Changed";  // Silently fails (or throws in strict mode)
```

**Why AI does this:** AI conflates `const` with immutability from other languages (Rust, Java `final`).

---

## 3. Async / Promises

### 3.1 Not awaiting promises

```javascript
// ❌ WRONG — function returns before async work completes
async function savePatient(data) {
  database.save(data);  // Missing await! Returns undefined immediately
  return { success: true };  // Returned before save finishes
}

// ✅ RIGHT
async function savePatient(data) {
  await database.save(data);
  return { success: true };
}
```

**Why AI does this:** The code looks syntactically correct. No error at write time. The bug is at runtime.

### 3.2 Using `.then()` inside async functions

```javascript
// ❌ WRONG — mixing patterns, harder to read and debug
async function getData() {
  return fetch(url)
    .then(res => res.json())
    .then(data => data.results)
    .catch(err => console.error(err));
}

// ✅ RIGHT — consistent async/await
async function getData() {
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.results;
  } catch (err) {
    logger.error("Fetch failed", { error: err });
    throw err;
  }
}
```

**Why AI does this:** `.then()` chains exist heavily in training data. AI mixes old and new patterns.

### 3.3 Sequential awaits when parallel is possible

```javascript
// ❌ WRONG — waits for each to finish before starting next (3 seconds total)
const patients = await fetchPatients();
const providers = await fetchProviders();
const beds = await fetchBeds();

// ✅ RIGHT — all three run simultaneously (1 second total)
const [patients, providers, beds] = await Promise.all([
  fetchPatients(),
  fetchProviders(),
  fetchBeds(),
]);
```

**Why AI does this:** Sequential code is easier to generate. AI doesn't analyze data dependencies.

### 3.4 Ignoring Promise rejection

```javascript
// ❌ WRONG — unhandled rejection crashes Node.js
fetchData().then(process);

// ❌ ALSO WRONG — catch swallows the error
fetchData().then(process).catch(() => {});

// ✅ RIGHT — handle the rejection meaningfully
fetchData()
  .then(process)
  .catch(err => {
    logger.error("Data fetch failed", { error: err });
    showErrorToUser("Unable to load data");
  });
```

**Why AI does this:** The happy path is the interesting part. Error handling is an afterthought.

### 3.5 Creating a `new Promise` unnecessarily

```javascript
// ❌ WRONG — wrapping an existing promise in a new promise
function getData() {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then(res => res.json())
      .then(data => resolve(data))
      .catch(err => reject(err));
  });
}

// ✅ RIGHT — just return the promise chain
function getData() {
  return fetch(url).then(res => res.json());
}

// ✅ EVEN BETTER — async/await
async function getData() {
  const res = await fetch(url);
  return res.json();
}
```

**Why AI does this:** The `new Promise` wrapper pattern was common in early Promise tutorials. AI over-applies it.

### 3.6 `forEach` with async callbacks

```javascript
// ❌ WRONG — forEach doesn't await the callbacks
items.forEach(async (item) => {
  await processItem(item);  // These all fire simultaneously, forEach returns void
});
// Code here runs BEFORE all items are processed

// ✅ RIGHT — for...of for sequential processing
for (const item of items) {
  await processItem(item);
}

// ✅ RIGHT — Promise.all for parallel processing
await Promise.all(items.map(item => processItem(item)));
```

**Why AI does this:** `forEach` looks like a loop. AI doesn't know it ignores the return value of callbacks.

---

## 4. Error Handling

### 4.1 Empty catch blocks

```javascript
// ❌ WRONG — error vanishes
try {
  await saveRecord(data);
} catch (e) {
  // do nothing
}

// ✅ RIGHT — log and handle
try {
  await saveRecord(data);
} catch (err) {
  logger.error("Save failed", { error: err, recordId: data.id });
  throw new ServiceError("Failed to save record", { cause: err });
}
```

**Why AI does this:** The catch block satisfies the linter. AI treats error handling as a formality.

### 4.2 Catching and re-throwing without context

```javascript
// ❌ WRONG — original error context lost
try {
  await processPayment(claim);
} catch (err) {
  throw new Error("Payment failed");  // What was the original error?
}

// ✅ RIGHT — preserve the cause chain
try {
  await processPayment(claim);
} catch (err) {
  throw new Error("Payment processing failed", { cause: err });
}
```

**Why AI does this:** AI generates a "clean" error message without considering debuggability.

### 4.3 Using `err.message` without checking type

```javascript
// ❌ WRONG — err might not be an Error object
catch (err) {
  console.log(err.message);  // TypeError if err is a string or number
}

// ✅ RIGHT — type-safe error handling
catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  logger.error("Operation failed", { message });
}
```

**Why AI does this:** AI assumes catch always receives an Error object. In JavaScript, you can `throw` anything.

### 4.4 Not handling fetch response status

```javascript
// ❌ WRONG — fetch doesn't throw on 4xx/5xx
const response = await fetch(url);
const data = await response.json();  // Tries to parse error HTML as JSON

// ✅ RIGHT — check response.ok
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}
const data = await response.json();
```

**Why AI does this:** AI treats `fetch` like Axios (which throws on non-2xx). The `fetch` API's design is counterintuitive.

---

## 5. `this` Binding & Context

### 5.1 Losing `this` in callbacks

```javascript
// ❌ WRONG — `this` is undefined or window in the callback
class PatientService {
  patients = [];

  loadAll() {
    fetchPatients().then(function(data) {
      this.patients = data;  // `this` is NOT the PatientService
    });
  }
}

// ✅ RIGHT — arrow function preserves `this`
class PatientService {
  patients = [];

  loadAll() {
    fetchPatients().then((data) => {
      this.patients = data;  // Arrow function inherits `this`
    });
  }
}
```

**Why AI does this:** AI mixes `function` and arrow function syntax without considering `this` binding.

### 5.2 Using `this` in arrow functions on object literals

```javascript
// ❌ WRONG — arrow functions don't have their own `this`
const handler = {
  name: "PatientHandler",
  process: () => {
    console.log(this.name);  // `this` is the outer scope, NOT handler
  }
};

// ✅ RIGHT — use regular function for object methods
const handler = {
  name: "PatientHandler",
  process() {
    console.log(this.name);  // `this` is handler
  }
};
```

**Why AI does this:** Arrow functions are "modern." AI uses them everywhere without considering context.

---

## 6. Array & Object Manipulation

### 6.1 Mutating arrays when immutability is expected

```javascript
// ❌ WRONG — mutates the original array (breaks React state, confuses consumers)
function addPatient(patients, newPatient) {
  patients.push(newPatient);  // Mutates!
  return patients;
}

// ✅ RIGHT — return a new array
function addPatient(patients, newPatient) {
  return [...patients, newPatient];
}
```

**Why AI does this:** `.push()` is the "natural" way to add items. AI doesn't consider immutability requirements.

### 6.2 Shallow copy when deep copy is needed

```javascript
// ❌ WRONG — nested objects are still shared references
const copy = { ...original };
copy.address.city = "Houston";  // Also changes original.address.city!

// ✅ RIGHT — deep clone
const copy = structuredClone(original);  // Modern browsers + Node 17+
copy.address.city = "Houston";  // Original unchanged
```

**Why AI does this:** Spread `{...}` looks like a full copy. AI doesn't trace nested references.

### 6.3 Using `delete` on arrays

```javascript
// ❌ WRONG — leaves a hole, length unchanged
const items = [1, 2, 3];
delete items[1];  // [1, empty, 3], length still 3

// ✅ RIGHT — use splice or filter
items.splice(1, 1);  // [1, 3], length 2
// or
const filtered = items.filter((_, i) => i !== 1);
```

**Why AI does this:** `delete` works on objects. AI applies it to arrays without knowing the semantics differ.

### 6.4 `for...in` on arrays

```javascript
// ❌ WRONG — iterates all enumerable properties, including prototype
for (const i in arr) {
  console.log(arr[i]);  // May include prototype properties
}

// ✅ RIGHT — for...of for values
for (const item of arr) {
  console.log(item);
}

// ✅ ALSO RIGHT — forEach or map for functional style
arr.forEach(item => console.log(item));
```

**Why AI does this:** `for...in` and `for...of` look similar. AI doesn't always pick the right one.

---

## 7. Scope & Closures

### 7.1 Closure over loop variable (classic trap)

```javascript
// ❌ WRONG with var — all callbacks share the same i
for (var i = 0; i < buttons.length; i++) {
  buttons[i].addEventListener('click', function() {
    console.log(i);  // Always logs buttons.length
  });
}

// ✅ RIGHT — use let (block-scoped)
for (let i = 0; i < buttons.length; i++) {
  buttons[i].addEventListener('click', function() {
    console.log(i);  // Logs 0, 1, 2, ...
  });
}
```

**Why AI does this:** This is JavaScript's second-most-famous gotcha. AI still generates `var` in loops.

### 7.2 Accidental global variables

```javascript
// ❌ WRONG — missing declaration creates a global
function process() {
  result = computeRisk();  // `result` is now a global variable
  return result;
}

// ✅ RIGHT — always declare
function process() {
  const result = computeRisk();
  return result;
}
```

**Why AI does this:** AI generates quick code and sometimes omits declarations, especially in refactored snippets.

### 7.3 Stale closures in React

```javascript
// ❌ WRONG — count is captured at render time, never updates
useEffect(() => {
  const interval = setInterval(() => {
    setCount(count + 1);  // Always references the initial count
  }, 1000);
  return () => clearInterval(interval);
}, []);  // Empty deps — count is stale

// ✅ RIGHT — use functional updater
useEffect(() => {
  const interval = setInterval(() => {
    setCount(prev => prev + 1);  // Always uses latest value
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

**Why AI does this:** AI doesn't mentally simulate the closure lifecycle. The code "looks right."

---

## 8. Security Vulnerabilities

### 8.1 `innerHTML` with user data (XSS)

```javascript
// ❌ WRONG — XSS vulnerability
element.innerHTML = `<div>${userInput}</div>`;
// If userInput = '<script>steal(cookies)</script>' → game over

// ✅ RIGHT — use textContent for text
element.textContent = userInput;

// ✅ RIGHT — use DOM APIs for structure
const div = document.createElement('div');
div.textContent = userInput;
element.appendChild(div);

// ✅ RIGHT (React) — JSX auto-escapes
return <div>{userInput}</div>;  // Safe by default
```

**Why AI does this:** `innerHTML` is the quickest way to inject content. AI doesn't assess the source of the data.

### 8.2 `eval()` and `Function()` constructor

```javascript
// ❌ WRONG — arbitrary code execution
eval(userInput);
const fn = new Function(userInput);

// ✅ RIGHT — use JSON.parse for data
const data = JSON.parse(userInput);

// ✅ RIGHT — use a safe expression parser if needed
import { evaluate } from 'safe-expression-parser';
const result = evaluate(expression);
```

**Why AI does this:** `eval` is the "easy" solution for dynamic code. AI doesn't consider the attack surface.

### 8.3 Prototype pollution

```javascript
// ❌ WRONG — merging untrusted input can poison Object.prototype
function merge(target, source) {
  for (const key in source) {
    target[key] = source[key];  // If key is "__proto__", all objects are affected
  }
}

// ✅ RIGHT — guard against prototype keys
function merge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    target[key] = source[key];
  }
}

// ✅ BETTER — use Object.assign or structuredClone
Object.assign(target, source);  // Doesn't copy prototype properties
```

**Why AI does this:** AI writes naive merge utilities. Prototype pollution is a JavaScript-specific attack that doesn't exist in most languages.

### 8.4 Regex denial of service (ReDoS)

```javascript
// ❌ WRONG — catastrophic backtracking on adversarial input
const emailRegex = /^([a-zA-Z0-9]+\.?)+@([a-zA-Z0-9]+\.)+[a-zA-Z]{2,}$/;
emailRegex.test(maliciousInput);  // Can take minutes

// ✅ RIGHT — use a well-tested validation library
import { isEmail } from 'validator';
isEmail(userInput);
```

**Why AI does this:** AI generates regexes that look correct but have exponential backtracking on crafted inputs.

### 8.5 Exposing secrets in client-side code

```javascript
// ❌ WRONG — bundled into client JavaScript, visible to anyone
const API_SECRET = "sk_live_abc123";
const DB_PASSWORD = process.env.DB_PASSWORD;  // Bundled by Webpack/Vite

// ✅ RIGHT — only VITE_* prefixed vars are client-safe (in Vite)
const API_URL = import.meta.env.VITE_API_URL;  // Public, intentionally exposed

// ✅ RIGHT — secrets stay server-side
// Use an API route/edge function to proxy requests that need secrets
```

**Why AI does this:** AI treats client and server code the same. It doesn't consider what gets bundled.

---

## 9. DOM & Browser APIs

### 9.1 Querying DOM before it's ready

```javascript
// ❌ WRONG — element doesn't exist yet if script is in <head>
const btn = document.getElementById('submit');
btn.addEventListener('click', handler);  // TypeError: btn is null

// ✅ RIGHT — wait for DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('submit');
  btn?.addEventListener('click', handler);
});

// ✅ RIGHT (modern) — use defer attribute on script tag
// <script defer src="app.js"></script>
```

**Why AI does this:** AI generates code without considering execution timing.

### 9.2 Memory leaks from event listeners

```javascript
// ❌ WRONG — listeners accumulate, never removed
function showPopup() {
  window.addEventListener('resize', handleResize);
  // Called every time popup opens — listeners stack up
}

// ✅ RIGHT — clean up
function showPopup() {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}

// ✅ RIGHT — AbortController for bulk cleanup
const controller = new AbortController();
window.addEventListener('resize', handleResize, { signal: controller.signal });
window.addEventListener('scroll', handleScroll, { signal: controller.signal });
// Later: controller.abort() removes all listeners
```

**Why AI does this:** Adding listeners is the "visible" part. Cleanup is invisible and easy to forget.

### 9.3 Synchronous `localStorage` blocking

```javascript
// ❌ RISKY — localStorage is synchronous and can block rendering
for (const item of largeDataset) {
  localStorage.setItem(item.id, JSON.stringify(item));  // Blocks main thread
}

// ✅ RIGHT — batch and use async storage for large data
// Use IndexedDB for large datasets
const db = await openDB('app', 1);
const tx = db.transaction('items', 'readwrite');
for (const item of largeDataset) {
  tx.store.put(item);
}
await tx.done;
```

**Why AI does this:** `localStorage` is the simplest storage API. AI doesn't consider data volume.

---

## 10. React-Specific Mistakes

### 10.1 Mutating state directly

```javascript
// ❌ WRONG — mutation, React doesn't re-render
const [patients, setPatients] = useState([]);
patients.push(newPatient);  // Mutates state directly
setPatients(patients);       // Same reference — React skips re-render

// ✅ RIGHT — create new reference
setPatients(prev => [...prev, newPatient]);
```

**Why AI does this:** `.push()` is the natural array operation. AI doesn't always remember React's immutability requirement.

### 10.2 Missing dependency array in hooks

```javascript
// ❌ WRONG — runs on every render
useEffect(() => {
  fetchPatientData(patientId);
});  // No dependency array!

// ❌ ALSO WRONG — empty array when dependencies exist
useEffect(() => {
  fetchPatientData(patientId);
}, []);  // patientId changes won't trigger re-fetch

// ✅ RIGHT — correct dependencies
useEffect(() => {
  fetchPatientData(patientId);
}, [patientId]);
```

**Why AI does this:** AI either forgets the dependency array entirely or uses `[]` to "prevent infinite loops" without analyzing actual dependencies.

### 10.3 Using `forwardRef` (React 19+)

```javascript
// ❌ WRONG — forwardRef is unnecessary in React 19
const Input = forwardRef((props, ref) => {
  return <input ref={ref} {...props} />;
});

// ✅ RIGHT — ref is a regular prop in React 19
const Input = ({ ref, ...props }) => {
  return <input ref={ref} {...props} />;
};
```

**Why AI does this:** Pre-React 19 patterns dominate training data. AI doesn't check the React version.

### 10.4 `process.env` in Vite projects

```javascript
// ❌ WRONG — Vite doesn't use process.env
const apiUrl = process.env.REACT_APP_API_URL;

// ✅ RIGHT — Vite uses import.meta.env
const apiUrl = import.meta.env.VITE_API_URL;
```

**Why AI does this:** Create React App (CRA) used `process.env.REACT_APP_*`. CRA dominated React training data for years.

### 10.5 Creating state for derived values

```javascript
// ❌ WRONG — unnecessary state, desynchronization risk
const [patients, setPatients] = useState([]);
const [activeCount, setActiveCount] = useState(0);

useEffect(() => {
  setActiveCount(patients.filter(p => p.active).length);
}, [patients]);

// ✅ RIGHT — derive during render
const [patients, setPatients] = useState([]);
const activeCount = patients.filter(p => p.active).length;

// ✅ RIGHT — useMemo if computation is expensive
const activeCount = useMemo(
  () => patients.filter(p => p.active).length,
  [patients]
);
```

**Why AI does this:** AI creates state for everything. It doesn't distinguish between source-of-truth state and derived values.

### 10.6 Inline object/function creation causing re-renders

```javascript
// ❌ WRONG — new object every render, children always re-render
<ChildComponent style={{ color: 'blue' }} onChange={() => handleChange(id)} />

// ✅ RIGHT — stable references
const style = useMemo(() => ({ color: 'blue' }), []);
const handleItemChange = useCallback(() => handleChange(id), [id]);
<ChildComponent style={style} onChange={handleItemChange} />
```

**Why AI does this:** Inline objects and arrow functions are concise. AI doesn't consider referential equality.

### 10.7 Keys in lists using array index

```javascript
// ❌ WRONG — index keys cause bugs when list is reordered/filtered
{patients.map((patient, index) => (
  <PatientCard key={index} patient={patient} />
))}

// ✅ RIGHT — stable, unique identifier
{patients.map(patient => (
  <PatientCard key={patient.id} patient={patient} />
))}
```

**Why AI does this:** `index` is always available. AI reaches for the easiest key value.

---

## 11. Node.js / Server-Side Mistakes

### 11.1 Blocking the event loop

```javascript
// ❌ WRONG — synchronous file read blocks all requests
app.get('/report', (req, res) => {
  const data = fs.readFileSync('large-report.csv', 'utf-8');  // Blocks
  res.send(processReport(data));
});

// ✅ RIGHT — async file operations
app.get('/report', async (req, res) => {
  const data = await fs.promises.readFile('large-report.csv', 'utf-8');
  res.send(processReport(data));
});
```

**Why AI does this:** `readFileSync` is simpler. AI doesn't consider concurrent request handling.

### 11.2 Not handling process signals

```javascript
// ❌ WRONG — process dies with open connections
const server = app.listen(3000);

// ✅ RIGHT — graceful shutdown
const server = app.listen(3000);

process.on('SIGTERM', () => {
  server.close(() => {
    db.end();  // Close database connections
    process.exit(0);
  });
});
```

**Why AI does this:** Signal handling is infrastructure code. AI focuses on application logic.

### 11.3 Trusting client headers without validation

```javascript
// ❌ WRONG — X-Forwarded-For can be spoofed
const clientIp = req.headers['x-forwarded-for'];
await logAccess(clientIp, req.url);

// ✅ RIGHT — validate and use trusted proxy settings
app.set('trust proxy', 1);  // Trust first proxy
const clientIp = req.ip;     // Express uses trust proxy settings
```

**Why AI does this:** Headers are "available." AI doesn't assess which headers are trustworthy.

### 11.4 Returning detailed errors to clients

```javascript
// ❌ WRONG — exposes stack trace, file paths, SQL queries
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack,
    query: err.sql
  });
});

// ✅ RIGHT — generic client message, detailed server log
app.use((err, req, res, next) => {
  logger.error("Request failed", {
    error: err,
    path: req.path,
    method: req.method
  });
  res.status(500).json({ error: "Internal server error" });
});
```

**Why AI does this:** Detailed errors are "helpful for debugging." AI doesn't distinguish client-facing from server-side.

---

## 12. Testing Anti-Patterns

### 12.1 Testing implementation details

```javascript
// ❌ WRONG — breaks on any refactor
test('calls internal _validate method', () => {
  const spy = jest.spyOn(service, '_validate');
  service.process(data);
  expect(spy).toHaveBeenCalled();
});

// ✅ RIGHT — test observable behavior
test('rejects invalid patient data', async () => {
  const result = await service.process(invalidData);
  expect(result.success).toBe(false);
  expect(result.error).toBe('VALIDATION_ERROR');
});
```

**Why AI does this:** Spying on internals is "thorough." AI doesn't understand the maintenance cost.

### 12.2 Not cleaning up between tests

```javascript
// ❌ WRONG — tests pollute each other
test('first test', () => {
  mockService.getData.mockReturnValue({ items: [] });
  // ... test code
});

test('second test', () => {
  // mockService.getData still returns { items: [] } from previous test!
  const result = render(<Component />);
});

// ✅ RIGHT — reset mocks explicitly
beforeEach(() => {
  vi.resetAllMocks();  // Resets implementations AND calls
});
```

**Why AI does this:** AI treats tests as independent. It doesn't realize `mockReturnValue` persists.

### 12.3 Synchronous assertions on async DOM updates

```javascript
// ❌ WRONG — flaky, races with React state updates
fireEvent.click(screen.getByText('Submit'));
expect(screen.getByText('Success')).toBeInTheDocument();  // May not exist yet

// ✅ RIGHT — wait for the update
fireEvent.click(screen.getByText('Submit'));
expect(await screen.findByText('Success')).toBeInTheDocument();
```

**Why AI does this:** Synchronous code is simpler. AI doesn't account for React's async rendering.

### 12.4 Using realistic-looking PHI in test data

```javascript
// ❌ WRONG — looks real, triggers compliance flags
const testPatient = { name: "John Smith", dob: "1958-03-15", ssn: "123-45-6789" };

// ✅ RIGHT — obviously fake
const testPatient = { name: "Test Patient Alpha", dob: "2000-01-01", ssn: "000-00-0000" };
```

**Why AI does this:** AI generates "realistic" data to make tests look professional.

---

## 13. Module System Confusion

### 13.1 Mixing CommonJS and ESM

```javascript
// ❌ WRONG — mixing require and import
const express = require('express');
import { Router } from 'express';  // SyntaxError in CJS context

// ✅ RIGHT — pick one system and stick with it
// ESM (modern — preferred)
import express from 'express';
import { Router } from 'express';

// CJS (legacy — Node.js default without "type": "module")
const express = require('express');
const { Router } = require('express');
```

**Why AI does this:** AI generates code for "Node.js" without checking whether the project uses CJS or ESM.

### 13.2 Default export confusion

```javascript
// ❌ CONFUSING — named export imported as default
// utils.js
export function calculate() { ... }

// consumer.js
import calculate from './utils';  // WRONG — this imports the default export (undefined)
import { calculate } from './utils';  // RIGHT

// ❌ ALSO CONFUSING — default and named exports on same module
export default class Service { ... }
export function helper() { ... }
// Now consumers don't know which import syntax to use
```

**Why AI does this:** AI doesn't consistently track whether a module uses default or named exports.

### 13.3 Missing file extensions in Deno/ESM

```javascript
// ❌ WRONG — Deno requires extensions, Node ESM requires them too
import { helper } from './utils';       // Works in bundlers, fails in Deno
import { helper } from '../_shared/env'; // Missing .ts extension

// ✅ RIGHT — explicit extensions
import { helper } from './utils.ts';          // Deno
import { helper } from '../_shared/env.ts';   // Deno edge functions
import { helper } from './utils.js';          // Node ESM
```

**Why AI does this:** Bundlers (Webpack, Vite) strip extensions automatically. AI doesn't track which runtime it's targeting.

---

## 14. Performance Pitfalls

### 14.1 Creating objects in render paths

```javascript
// ❌ WRONG — new regex on every function call
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;  // Recompiled every call
  return regex.test(email);
}

// ✅ RIGHT — compile once
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateEmail(email) {
  return EMAIL_REGEX.test(email);
}
```

**Why AI does this:** Putting the regex near its usage feels "clean." AI doesn't consider hot paths.

### 14.2 Unnecessary spread in loops

```javascript
// ❌ WRONG — O(n²) due to spread creating new array each iteration
let result = [];
for (const item of items) {
  result = [...result, transform(item)];  // Copies entire array each time
}

// ✅ RIGHT — O(n) with push
const result = [];
for (const item of items) {
  result.push(transform(item));
}

// ✅ RIGHT — O(n) with map
const result = items.map(item => transform(item));
```

**Why AI does this:** Spread is the "immutable" pattern. AI applies it inside loops without considering the cost.

### 14.3 Not debouncing/throttling event handlers

```javascript
// ❌ WRONG — fires on every keystroke, hammers API
input.addEventListener('input', async (e) => {
  const results = await searchAPI(e.target.value);
  renderResults(results);
});

// ✅ RIGHT — debounce
import { debounce } from 'lodash';
const debouncedSearch = debounce(async (value) => {
  const results = await searchAPI(value);
  renderResults(results);
}, 300);

input.addEventListener('input', (e) => debouncedSearch(e.target.value));
```

**Why AI does this:** The immediate handler "works." AI doesn't think about request volume.

### 14.4 Memory leaks from closures holding references

```javascript
// ❌ WRONG — closure keeps the entire response object alive
function processData(hugeResponse) {
  const id = hugeResponse.id;
  return function() {
    return id;  // Closure captures the whole scope, including hugeResponse
  };
}

// ✅ RIGHT — extract only what you need before creating the closure
function processData(hugeResponse) {
  const id = hugeResponse.id;
  const extracted = id;  // Primitive — no reference to hugeResponse
  return function() {
    return extracted;
  };
}
```

**Why AI does this:** Closures are implicit. AI doesn't analyze what variables are captured.

---

## 15. TypeScript-Specific Mistakes

### 15.1 Using `any` as a crutch

```typescript
// ❌ WRONG — defeats the purpose of TypeScript
function process(data: any): any { ... }
catch (err: any) { ... }

// ✅ RIGHT — use unknown + narrowing
function process(data: unknown): ProcessResult { ... }
catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
}
```

**Why AI does this:** `any` makes type errors disappear. AI optimizes for "compiles" not "correct."

### 15.2 Type assertions (`as`) instead of type guards

```typescript
// ❌ WRONG — trusts the developer, crashes at runtime if wrong
const patient = data as Patient;
console.log(patient.name);  // Runtime crash if data has no name

// ✅ RIGHT — runtime validation
function isPatient(data: unknown): data is Patient {
  return typeof data === 'object' && data !== null && 'name' in data && 'id' in data;
}

if (isPatient(data)) {
  console.log(data.name);  // TypeScript knows data is Patient
}
```

**Why AI does this:** `as` is a one-line fix. Type guards require writing a function.

### 15.3 Enum pitfalls

```typescript
// ❌ RISKY — numeric enums allow invalid values
enum Status { Active, Inactive, Deleted }
const s: Status = 99;  // No error! Numeric enums are just numbers

// ✅ RIGHT — string unions or const objects
type Status = 'active' | 'inactive' | 'deleted';

// Or const object for runtime access
const Status = {
  Active: 'active',
  Inactive: 'inactive',
  Deleted: 'deleted',
} as const;
type Status = typeof Status[keyof typeof Status];
```

**Why AI does this:** Enums look like a "proper" type system feature. AI doesn't know about numeric enum's loose typing.

### 15.4 Not using `satisfies` (TypeScript 4.9+)

```typescript
// ❌ SUBOPTIMAL — type annotation loses literal types
const config: Config = { mode: 'strict', timeout: 30 };
// config.mode is typed as string, not 'strict'

// ✅ RIGHT — satisfies preserves literal types while validating
const config = { mode: 'strict', timeout: 30 } satisfies Config;
// config.mode is typed as 'strict' (literal)
```

**Why AI does this:** `satisfies` is relatively new. AI defaults to `: Type` annotations from older training data.

---

## 16. Dependency & Build Tool Mistakes

### 16.1 Not pinning dependency versions

```json
// ❌ WRONG — non-deterministic installs
{
  "dependencies": {
    "react": "^19.0.0",
    "lodash": "~4.17.0"
  }
}

// ✅ RIGHT — exact versions + lockfile
{
  "dependencies": {
    "react": "19.0.0",
    "lodash": "4.17.21"
  }
}
// Plus: commit package-lock.json / yarn.lock
```

**Why AI does this:** `^` is npm's default. AI doesn't consider reproducibility.

### 16.2 Adding dependencies without checking bundle impact

```javascript
// ❌ WRONG — importing all of lodash for one function (70KB+)
import _ from 'lodash';
const result = _.debounce(fn, 300);

// ✅ RIGHT — import only what you need
import debounce from 'lodash/debounce';  // ~1KB
const result = debounce(fn, 300);
```

**Why AI does this:** The full import is one line. AI doesn't check bundle sizes.

### 16.3 Confusing devDependencies and dependencies

```json
// ❌ WRONG — test tools shipped to production
{
  "dependencies": {
    "jest": "^29.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0"
  }
}

// ✅ RIGHT — test tools in devDependencies
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0"
  }
}
```

**Why AI does this:** `npm install package` defaults to `dependencies`. AI doesn't always add `--save-dev`.

### 16.4 Not cleaning up unused dependencies

```json
// After refactoring, packages like these linger:
{
  "dependencies": {
    "moment": "2.30.1",     // Replaced by date-fns 3 commits ago
    "axios": "1.6.0",        // Replaced by fetch 2 months ago
    "classnames": "2.5.1"    // Replaced by clsx
  }
}
```

**Why AI does this:** AI adds packages but never removes old ones. It doesn't audit the dependency list.

---

## Summary — Top 10 JavaScript Mistakes by Frequency

| # | Mistake | Section | Impact |
|---|---------|---------|--------|
| 1 | Not awaiting promises / missing `await` | 3.1 | Silent data loss, race conditions |
| 2 | Empty catch blocks / swallowing errors | 4.1 | Impossible to debug in production |
| 3 | Mutating state directly (React) | 10.1 | UI doesn't update, stale data displayed |
| 4 | `==` instead of `===` | 1.1 | Subtle coercion bugs |
| 5 | Using `any` in TypeScript | 15.1 | Type safety completely defeated |
| 6 | `forEach` with async callbacks | 3.6 | Async operations fire simultaneously, uncontrolled |
| 7 | Missing useEffect dependencies | 10.2 | Stale closures, infinite re-renders |
| 8 | `innerHTML` with user data (XSS) | 8.1 | Critical security vulnerability |
| 9 | Sequential awaits when parallel is possible | 3.3 | 3x-10x slower than necessary |
| 10 | Index keys in React lists | 10.7 | State corruption on reorder/filter |

---

*This document is part of the AI Development Methodology by Envision Virtual Edge Group LLC.*
*It is a governance tool — not a tutorial. Every entry exists because an AI got it wrong.*
