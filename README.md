```bash
brew install ffmpeg
brew install emscripten
```
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install faster-whisper
```

```bash
emcc add.cpp -O3 -s WASM=1 -s EXPORTED_FUNCTIONS="['_add']" -o add.js
```

```html
<script src="add.js"></script>
<script>
Module.onRuntimeInitialized = () => {
  const res = Module._add(2, 3);
  console.log(res); // 5
};
</script>
```