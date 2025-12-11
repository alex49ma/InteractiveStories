import './App.css'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import StoryLoader from "./components/StoryLoader";

function App() {

  return (
    <Router>
      <div className="app-container">
        <header>
          <h1>Interactive StoryGenerator</h1>
        </header>
      </div>
    </Router>
  )
}

export default App
