import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import PublicRoute from './routes/PublicRoute.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import ActivateAccount from './pages/ActivateAccount'
import UserManagement from './pages/admin/UserManagement'
import DashboardLayout from './components/dashboard/DashboardLayout'
import CourseList from './pages/admin/CourseList'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import LearnerDashboard from './pages/learner/LearnerDashboard.jsx'
import InstructorDashboard from './pages/instructor/InstructorDashboard.jsx'
import InstructorCourses from './pages/instructor/InstructorCourses.jsx'
import InstructorAnalytics from './pages/instructor/InstructorAnalytics.jsx'
import InstructorLiveSessions from './pages/instructor/LiveSessions.jsx'
import ChatPage from './pages/Chat.jsx'
import Profile from './pages/Profile.jsx'
import LearnerCourses from './pages/learner/Courses.jsx'
import MyLearning from './pages/learner/MyLearning.jsx'
import CourseOverview from './pages/learner/CourseOverview.jsx'
import CourseLearningView from './pages/learner/CourseLearningView.jsx'
import Certificates from './pages/learner/Certificates.jsx'
import LearnerLiveSessions from './pages/learner/LiveSessions.jsx'
import LiveSessionRoom from './components/live/LiveSessionRoom.jsx'

export function AppRoutes() {
  return (
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
            <Route path="/password/reset/confirm/:uid/:token" element={<ResetPassword />} />
            <Route path="/activate/:uid/:token" element={<ActivateAccount />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/live-sessions/:sessionId/room" element={<LiveSessionRoom />} />
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<LearnerDashboard />} />
              <Route path="/instructor/dashboard" element={<InstructorDashboard />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route
                path="/admin/courses"
                element={
                  <CourseList
                    pageTitle="Modération des parcours"
                    pageSubtitle="Consultez les parcours créés par les formateurs et validez leur publication."
                    moderateOnly
                  />
                }
              />
              <Route path="/instructor/courses" element={<InstructorCourses />} />
              <Route path="/instructor/analytics" element={<InstructorAnalytics />} />
              <Route path="/instructor/live-sessions" element={<InstructorLiveSessions />} />
              <Route path="/live-sessions" element={<LearnerLiveSessions />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/progress" element={<Navigate to="/chat" replace />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/browse" element={<LearnerCourses />} />
              <Route path="/my-courses" element={<MyLearning />} />
              <Route path="/certificates" element={<Certificates />} />
              <Route path="/courses/:parcoursId" element={<CourseOverview />} />
              <Route path="/courses/:parcoursId/learn" element={<CourseLearningView />} />
              <Route path="/courses/:parcoursId/lessons/:leconId" element={<CourseLearningView />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
