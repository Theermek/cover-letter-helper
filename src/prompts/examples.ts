/**
 * Few-shot examples of letters that read as written by a person (TASK §6.5).
 *
 * They are deliberately uneven: different openings, no "Уважаемый ... / С
 * уважением", concrete details instead of adjectives, and one small specific
 * number each. The point is to show the register, not a template to copy.
 */

export const EXAMPLE_RU = `Здравствуйте!

Увидел вакансию фронтендера и решил написать. Последние три года пишу на React и TypeScript, крайний проект - внутренняя админка для логистики: Next.js, много таблиц с фильтрами, похоже на то, что вы описываете. Отдельно повозился с производительностью, списки на несколько тысяч строк заметно тормозили, разобрался с виртуализацией, стало ощутимо легче.

Из вашего описания ближе всего работа в паре с дизайнером. У нас отдельного верстальщика не было, макеты я разбирал сам и спорил про отступы напрямую.

Буду рад поговорить подробнее.
Ермек`;

export const EXAMPLE_EN = `Hi,

I saw your backend opening and wanted to reach out. I have been writing Go for about four years, mostly payment services. The last one handled around 2k requests per second, so a lot of my time went into database load and into retries that do not double-charge anyone.

The part of your description that caught my eye is moving off the monolith. We did that with billing: pulled it into its own service and kept the old and new paths running side by side for two months instead of switching over in one night.

Happy to walk you through any of it.

Alex`;
