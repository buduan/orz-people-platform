import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it } from 'vitest';

import IndexPage from '../../pages/index.vue';

describe('index page', () => {
  it('renders the engineering baseline status', async () => {
    const wrapper = await mountSuspended(IndexPage);

    expect(wrapper.get('h1').text()).toBe('Nuxt frontend is ready');
    expect(wrapper.text()).toContain('orz-people-platform-frontend');
    expect(wrapper.text()).toContain('ready');
  });
});
