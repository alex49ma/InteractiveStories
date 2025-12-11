function LoadingStatus({ theme }) {
    return (
        <div className="loading-container">
            <p>Generating your {theme} story...</p>
            <div className="loading-animation">
                <div className="spinner"></div>
            </div>
            <p className="loading-info">
                This might take a few seconds...
            </p>
        </div>
    )
}

export default LoadingStatus;
