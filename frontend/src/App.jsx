import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("Hello, World!");

  useEffect(() => {
    fetch("http://localhost:8000/")
      .then(res => res.json())
      .then(data => {
        console.log(data.message);
        setMessage(data.message);
      })
      .catch(console.error);
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>My Prototype Frontend</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;
