import "./App.css";
import "./style.css";

function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="mb-8 text-center text-4xl font-bold text-blue-600">
        Tailwind Test
      </h1>

      <div className="mx-auto max-w-4xl">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-2 text-xl font-semibold">Card 1</h2>
            <p className="text-gray-600">This is a simple Tailwind card.</p>
          </div>

          <div className="rounded-xl bg-green-500 p-6 text-white shadow-lg">
            <h2 className="mb-2 text-xl font-semibold">Card 2</h2>
            <p>This card has a green background.</p>
          </div>

          <div className="rounded-xl bg-purple-500 p-6 text-white shadow-lg">
            <h2 className="mb-2 text-xl font-semibold">Card 3</h2>
            <p>This card has a purple background.</p>
          </div>
        </div>

        <div className="mt-8 flex gap-4">
          <button className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white transition hover:bg-blue-700">
            Primary Button
          </button>

          <button className="rounded-lg border border-gray-300 px-5 py-2 font-medium transition hover:bg-gray-100">
            Secondary Button
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
