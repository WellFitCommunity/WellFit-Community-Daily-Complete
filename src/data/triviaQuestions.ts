export interface TriviaQuestion {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  cognitiveLabel: string;
}

export const triviaQuestions: TriviaQuestion[] = [
  // Easy Questions
  {
    id: 'e1',
    text: 'What is the color of a ripe banana?',
    options: ['Red', 'Blue', 'Yellow', 'Green'],
    correctAnswer: 'Yellow',
    difficulty: 'Easy',
    cognitiveLabel: 'Memory Recall',
  },
  {
    id: 'e2',
    text: 'Which animal is known as "man\'s best friend"?',
    options: ['Cat', 'Dog', 'Horse', 'Bird'],
    correctAnswer: 'Dog',
    difficulty: 'Easy',
    cognitiveLabel: 'General Knowledge',
  },
  {
    id: 'e3',
    text: 'How many seasons are there in a year?',
    options: ['Two', 'Three', 'Four', 'Five'],
    correctAnswer: 'Four',
    difficulty: 'Easy',
    cognitiveLabel: 'General Knowledge',
  },
  {
    id: 'e4',
    text: 'What do bees primarily make?',
    options: ['Honey', 'Wax', 'Silk', 'Pollen Bread'],
    correctAnswer: 'Honey',
    difficulty: 'Easy',
    cognitiveLabel: 'General Knowledge',
  },
  // Medium Questions
  {
    id: 'm1',
    text: 'What is the capital city of France?',
    options: ['London', 'Berlin', 'Madrid', 'Paris'],
    correctAnswer: 'Paris',
    difficulty: 'Medium',
    cognitiveLabel: 'General Knowledge',
  },
  {
    id: 'm2',
    text: 'Which planet is known for its rings?',
    options: ['Earth', 'Mars', 'Jupiter', 'Saturn'],
    correctAnswer: 'Saturn',
    difficulty: 'Medium',
    cognitiveLabel: 'Memory Recall',
  },
  {
    id: 'm3',
    text: 'If you have a bowl with 6 apples and you take away 4, how many do you have?',
    options: ['2', '4', '6', '10'],
    correctAnswer: '4', // Because you took 4 apples, so you have 4.
    difficulty: 'Medium',
    cognitiveLabel: 'Problem Solving',
  },
  // Hard Questions
  {
    id: 'h1',
    text: 'What is the chemical symbol for water?',
    options: ['H2O', 'CO2', 'O2', 'NaCl'],
    correctAnswer: 'H2O',
    difficulty: 'Hard',
    cognitiveLabel: 'Scientific Knowledge',
  },
  {
    id: 'h2',
    text: 'Who painted the Mona Lisa?',
    options: ['Vincent van Gogh', 'Pablo Picasso', 'Leonardo da Vinci', 'Claude Monet'],
    correctAnswer: 'Leonardo da Vinci',
    difficulty: 'Hard',
    cognitiveLabel: 'Historical Knowledge',
  },
  {
    id: 'h3',
    text: 'Complete the sequence: 2, 4, 8, 16, __?',
    options: ['24', '32', '64', '20'],
    correctAnswer: '32',
    difficulty: 'Hard',
    cognitiveLabel: 'Pattern Recognition',
  },
];
