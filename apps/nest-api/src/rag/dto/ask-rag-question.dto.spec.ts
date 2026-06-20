import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AskRagQuestionDto } from './ask-rag-question.dto';

describe('AskRagQuestionDto', () => {
  function validate(input: Record<string, unknown>) {
    return validateSync(plainToInstance(AskRagQuestionDto, input));
  }

  it('rejects questions that are too long for public model calls', () => {
    const errors = validate({
      question: 'a'.repeat(501),
      limit: 5,
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'question',
        }),
      ]),
    );
  });
});
