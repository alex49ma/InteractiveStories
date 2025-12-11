import { useState, useEffect } from "react";

import { useParams, useNavigate } from "react";
import axios from "axios";
import LoadingStatus from "./LoadingStatus";

const API_BASE_URL = "/api";

function StoryLoader() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [story, setStory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadStory(id);
    }, [id]);

    const loadStory = async (storyId) => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${API_BASE_URL}/stories/${storyId}/complete`)
            setStory(response.data);
            setLoading(false);
        }
        catch (error) {
            if (error.response?.status === 404) {
                setError("Story not found");
            }
            else {
                setError("Something went wrong");
            }
        }
        finally {
            setLoading(false);
        }
    }
    const createStory = () => {
        navigate("/");
    }

    if (loading) {
        return <LoadingStatus theme={"story"} />
    }

    if (error) {
        return <div className="story-loader">
            <div className="error-message">
                <h2>Story not found</h2>
                <p>{error}</p>
                <button onClick={createNewStory}>Create a new story</button>
            </div>
        </div>
    }

    if (story) {
        return <div className="story-loader">

        </div>
    }
}

export default StoryLoader;
