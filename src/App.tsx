import './App.css'
import { useNavigate } from 'react-router-dom'

function App() {
  const navigate = useNavigate()

  return (
    <>
      <section id="center">
        <div>
          <h1>Explore Your Procedure at Your Pace</h1>
          <p>
            Interactive AI-integrated surgery visualizations designed with patient comfort as the number one priority. Explore your procedure and ask questions, at your own pace, from anywhere.
          </p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => navigate('/walkthrough')}
        >
          Go To Walkthrough
        </button>
        <button
          type="button"
          className="counter"
          onClick={() => navigate('/walkthroughs-list')}
        >
          Go To Walkthroughs List
        </button>
      </section>
    </>
  )
}

export default App
