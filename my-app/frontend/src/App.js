import React from 'react';
import Login from './components/Login';   // ✅ import Login instead of SIP form
import './App.css';

function App() {
  return (
    <div className="App">
      <Login />                          {/* ✅ mount Login as root */}
    </div>
  );
}

export default App;
