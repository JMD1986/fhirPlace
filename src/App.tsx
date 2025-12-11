import "./App.css";
import SearchContainer from "./components/MainSearch/SearchContainer";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";

function App() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <SearchContainer />
      <Container maxWidth="lg" sx={{ flex: 1, py: 4 }}>
        {/* Main content area for results or other components */}
      </Container>
    </Box>
  );
}

export default App;
