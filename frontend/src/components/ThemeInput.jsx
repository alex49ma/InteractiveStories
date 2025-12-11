import { useState } from "react";

function ThemeInput({ onSubmit }) {
    const [theme, setTheme] = useState("");
    const [error, setError] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!theme.trim()) {
            setError("Please insert a theme name.")
            return;
        }

        onSubmit(theme);
    }

    return <div className="theme-input-container">
        <h2>Generate your adventure</h2>
        <p>Enter a theme for your story:</p>

        <form onSubmit={handleSubmit}>
            <div className="input-group">
                <input
                    type="text"
                    placeholder="Enter a theme"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className={error ? "error" : ""}
                />
                {error && <p className="error-text">{error}</p>}
            </div>
            <button type="submit" className="generate-btn">Generate Story</button>
        </form>
    </div>
}

export default ThemeInput;