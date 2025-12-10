import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import SearchContainer from "./components/MainSearch/SearchContainer";

function App() {
  return (
    <>
      <p className="read-the-docs">
        <SearchContainer />{" "}
      </p>
    </>
  );
}

export default App;
