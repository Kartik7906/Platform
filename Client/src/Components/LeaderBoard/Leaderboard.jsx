import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Leaderboard.css";

const LocalURL = "http://localhost:8000/api"

const Leaderboard = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await axios.get(`${LocalURL}/leaderboard/fetchUser-leaderBoard`);
        let leaderboardData = response.data;
        const currentAdmin = localStorage.getItem("adminName");
        if (currentAdmin) {
          leaderboardData = leaderboardData.filter(user => user.adminName === currentAdmin);
        }
        leaderboardData.sort((a, b) => b.overallScore - a.overallScore);
        setUsers(leaderboardData);
      } catch (error) {
        console.error("Error fetching leaderboard data:", error);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="leaderboard-container">
    <button className="BackBtn_toDashboardPage" onClick={()=> {window.location.href="/landingpage"}}>Back to Dashboard</button>
      <h2 className="leaderboard-title">Leaderboard</h2>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Username</th>
            <th>Overall Score</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr key={user.userId}>
              <td>{index + 1}</td>
              <td>{user.username}</td>
              <td>{user.overallScore.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;
