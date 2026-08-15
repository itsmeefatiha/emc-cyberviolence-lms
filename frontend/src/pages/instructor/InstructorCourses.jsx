import CourseList from '../admin/CourseList.jsx'

/**
 * Constructeur de parcours formateur — construction & publication complète des parcours,
 * avec questionnaires QCM/QCU en fin de chaque module.
 */
export default function InstructorCourses() {
  return (
    <CourseList
      pageTitle="Constructeur de parcours"
      pageSubtitle="Construisez vos parcours pédagogiques, ajoutez modules, leçons, médias et questionnaires d'évaluation, puis publiez-les."
      createButtonLabel="Nouveau parcours"
      ownOnly
    />
  )
}
